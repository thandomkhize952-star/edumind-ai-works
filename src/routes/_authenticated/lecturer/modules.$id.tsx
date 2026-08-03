import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getLecturerModuleDetail, getAssessmentReview } from "@/lib/lecturer.functions";
import { getMaterialUrl, uploadMaterial, deleteMaterial } from "@/lib/materials.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Clock, Download, Eye, FileUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lecturer/modules/$id")({
  component: ModuleDetail,
});

type QDraft = { question: string; options: string[]; correct_index: number; marks: number; answer_text: string };

function ModuleDetail() {
  const { id } = Route.useParams();
  const get = useServerFn(getLecturerModuleDetail);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["lecturer-module", id],
    queryFn: () => get({ data: { moduleId: id } }),
  });

  if (isLoading || !data) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <Button asChild variant="ghost" size="sm"><Link to="/lecturer/modules"><ArrowLeft className="mr-1 h-4 w-4" /> Back to modules</Link></Button>
      <div>
        <p className="text-sm text-muted-foreground">{data.module.qualifications?.code} · {data.module.qualifications?.title}</p>
        <h1 className="text-3xl font-bold">{data.module.code} — {data.module.title}</h1>
        <p className="mt-2 text-muted-foreground">{data.module.description || "No description."}</p>
      </div>

      <Tabs defaultValue="students">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="students">Students ({data.students.length})</TabsTrigger>
          <TabsTrigger value="assessments">Assessments ({data.assessments.length})</TabsTrigger>
          <TabsTrigger value="materials">Materials ({data.materials.length})</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          <Card>
            <CardHeader><CardTitle>Enrolled Students</CardTitle><CardDescription>Students enrolled via this module's qualification.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Student #</TableHead><TableHead>Email</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.students.map(s => (
                    <TableRow key={s.id}><TableCell>{s.full_name || "—"}</TableCell><TableCell>{s.student_number || "—"}</TableCell><TableCell className="text-muted-foreground">{s.email}</TableCell></TableRow>
                  ))}
                  {!data.students.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No students enrolled.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assessments"><AssessmentsTab moduleId={id} assessments={data.assessments} onChanged={() => qc.invalidateQueries({ queryKey: ["lecturer-module", id] })} /></TabsContent>
        <TabsContent value="materials"><MaterialsTab moduleId={id} materials={data.materials} onChanged={() => qc.invalidateQueries({ queryKey: ["lecturer-module", id] })} /></TabsContent>
        <TabsContent value="attendance"><AttendanceTab moduleId={id} students={data.students} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------- Assessments -------------------- */

function AssessmentsTab({ moduleId, assessments, onChanged }: { moduleId: string; assessments: any[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"quiz" | "test" | "exam" | "assignment">("quiz");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [timeLimit, setTimeLimit] = useState<string>("30");
  const [questions, setQuestions] = useState<QDraft[]>([blankQuestion()]);

  const isAssignment = type === "assignment";

  function resetForm() {
    setTitle(""); setDescription(""); setDueAt(""); setTimeLimit("30");
    setQuestions([blankQuestion()]);
  }

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const total = questions.reduce((a, q) => a + Number(q.marks || 0), 0);
      const { data: a, error } = await supabase.from("assessments").insert({
        module_id: moduleId,
        created_by: u.user.id,
        type,
        title,
        description,
        due_at: dueAt || null,
        total_marks: total,
        published: false,
        time_limit_minutes: isAssignment ? null : (timeLimit ? Number(timeLimit) : null),
      }).select().single();
      if (error) throw error;
      if (questions.length) {
        const rows = questions.map((q, i) => ({
          assessment_id: a.id,
          position: i,
          question: q.question,
          options: isAssignment ? [] : q.options,
          correct_index: isAssignment ? 0 : q.correct_index,
          answer_text: isAssignment ? (q.answer_text || null) : null,
          marks: q.marks,
        }));
        const { error: qe } = await supabase.from("assessment_questions").insert(rows);
        if (qe) throw qe;
      }
    },
    onSuccess: () => {
      toast.success("Assessment created");
      setOpen(false);
      resetForm();
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePublish = useMutation({
    mutationFn: async (a: any) => {
      const { error } = await supabase.from("assessments").update({ published: !a.published }).eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: onChanged,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (aid: string) => {
      const { error } = await supabase.from("assessments").delete().eq("id", aid);
      if (error) throw error;
    },
    onSuccess: onChanged,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle>Assessments</CardTitle><CardDescription>Quizzes, tests, exams and assignments.</CardDescription></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> New assessment</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader><DialogTitle>Create assessment</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v: any) => { setType(v); setQuestions([blankQuestion()]); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quiz">Quiz</SelectItem>
                      <SelectItem value="test">Test</SelectItem>
                      <SelectItem value="exam">Exam</SelectItem>
                      <SelectItem value="assignment">Assignment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Due (optional)</Label><Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
                {!isAssignment && (
                  <div>
                    <Label className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Time limit (minutes)</Label>
                    <Input type="number" min={1} placeholder="e.g. 30" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} />
                    <p className="mt-1 text-xs text-muted-foreground">Leave blank for no limit. The student's attempt auto-submits when time runs out.</p>
                  </div>
                )}
              </div>
              <div className="space-y-3 border-t pt-3">
                <div className="flex items-center justify-between">
                  <Label>{isAssignment ? "Questions (written answer)" : "Questions (multiple choice)"}</Label>
                  <Button size="sm" variant="outline" onClick={() => setQuestions(q => [...q, blankQuestion()])}><Plus className="mr-1 h-3 w-3" /> Add</Button>
                </div>
                {questions.map((q, qi) => (
                  <div key={qi} className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Q{qi + 1}</span>
                      <Button size="sm" variant="ghost" onClick={() => setQuestions(arr => arr.filter((_, i) => i !== qi))}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                    <Textarea placeholder="Question" rows={2} value={q.question} onChange={(e) => setQuestions(arr => arr.map((x, i) => i === qi ? { ...x, question: e.target.value } : x))} />
                    {isAssignment ? (
                      <div>
                        <Label className="text-xs">Model answer / marking notes (optional, not shown to students)</Label>
                        <Textarea
                          rows={3}
                          placeholder="Expected answer used when reviewing submissions"
                          value={q.answer_text}
                          onChange={(e) => setQuestions(arr => arr.map((x, i) => i === qi ? { ...x, answer_text: e.target.value } : x))}
                        />
                      </div>
                    ) : (
                      q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input type="radio" name={`correct-${qi}`} checked={q.correct_index === oi} onChange={() => setQuestions(arr => arr.map((x, i) => i === qi ? { ...x, correct_index: oi } : x))} />
                          <Input placeholder={`Option ${oi + 1}`} value={opt} onChange={(e) => setQuestions(arr => arr.map((x, i) => i === qi ? { ...x, options: x.options.map((o, j) => j === oi ? e.target.value : o) } : x))} />
                        </div>
                      ))
                    )}
                    <div className="flex items-center gap-2"><Label className="text-xs">Marks</Label><Input type="number" className="w-24" value={q.marks} onChange={(e) => setQuestions(arr => arr.map((x, i) => i === qi ? { ...x, marks: Number(e.target.value) } : x))} /></div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending || !title}>{create.isPending ? "Creating…" : "Create"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Marks</TableHead><TableHead>Time limit</TableHead><TableHead>Due</TableHead><TableHead>Published</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {assessments.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.title}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{a.type}</Badge></TableCell>
                <TableCell>{a.total_marks}</TableCell>
                <TableCell className="text-muted-foreground">{a.time_limit_minutes ? `${a.time_limit_minutes} min` : "—"}</TableCell>
                <TableCell className="text-muted-foreground">{a.due_at ? new Date(a.due_at).toLocaleString() : "—"}</TableCell>
                <TableCell><Switch checked={a.published} onCheckedChange={() => togglePublish.mutate(a)} /></TableCell>
                <TableCell className="text-right">
                  <ReviewButton assessmentId={a.id} totalMarks={a.total_marks} type={a.type} onChanged={onChanged} />
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete assessment?")) remove.mutate(a.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!assessments.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No assessments yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function blankQuestion(): QDraft {
  return { question: "", options: ["", "", "", ""], correct_index: 0, marks: 1, answer_text: "" };
}

function ReviewButton({ assessmentId, totalMarks, type, onChanged }: { assessmentId: string; totalMarks: number; type: string; onChanged: () => void }) {
  const autoGraded = type === "quiz" || type === "test";
  const [open, setOpen] = useState(false);
  const get = useServerFn(getAssessmentReview);
  const qc = useQueryClient();
  const { data, refetch } = useQuery({
    queryKey: ["assessment-review", assessmentId],
    queryFn: () => get({ data: { assessmentId } }),
    enabled: open,
  });

  const update = useMutation({
    mutationFn: async ({ id, score, feedback }: { id: string; score: number; feedback: string }) => {
      const { error } = await supabase.from("submissions").update({ score, feedback, graded_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); refetch(); onChanged(); qc.invalidateQueries({ queryKey: ["my-marks"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost"><Eye className="mr-1 h-4 w-4" /> {autoGraded ? "Review" : "Review & grade"}</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{autoGraded ? "Review submissions (auto-marked)" : "Review submissions"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {data?.submissions.map((s: any) => (
            <SubmissionReview
              key={s.id}
              s={s}
              questions={data.questions}
              totalMarks={totalMarks}
              canGrade={!autoGraded}
              onSave={(score, feedback) => update.mutate({ id: s.id, score, feedback })}
            />
          ))}
          {data && !data.submissions.length && <p className="text-center text-muted-foreground">No submissions yet.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SubmissionReview({ s, questions, totalMarks, canGrade, onSave }: { s: any; questions: any[]; totalMarks: number; canGrade: boolean; onSave: (score: number, feedback: string) => void }) {
  const [score, setScore] = useState(s.score ?? 0);
  const [feedback, setFeedback] = useState(s.feedback ?? "");
  const [showAnswers, setShowAnswers] = useState(false);
  const answers = (s.answers ?? {}) as Record<string, number | string>;

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium">{s.student?.full_name || "—"}</div>
          <div className="text-xs text-muted-foreground">{s.student?.student_number ? `${s.student.student_number} · ` : ""}{s.student?.email}</div>
        </div>
        <div className="flex items-center gap-2">
          {canGrade
            ? (s.graded_at ? <Badge variant="secondary">Graded</Badge> : <Badge>Awaiting grading</Badge>)
            : <Badge variant="secondary">Auto-marked: {s.score ?? 0} / {totalMarks}</Badge>}
          <Button size="sm" variant="outline" onClick={() => setShowAnswers(v => !v)}>
            <Eye className="mr-1 h-3.5 w-3.5" /> {showAnswers ? "Hide answers" : "View answers"}
          </Button>
        </div>
      </div>

      {showAnswers && (
        <div className="mt-3 space-y-3 border-t pt-3">
          {questions.map((q, i) => {
            const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
            const isMCQ = opts.length > 0;
            const val = answers[q.id];
            const correct = isMCQ && val === q.correct_index;
            return (
              <div key={q.id} className="rounded-md bg-muted/40 p-3 text-sm">
                <p className="font-medium">Q{i + 1}. {q.question} <span className="text-xs text-muted-foreground">({q.marks} marks)</span></p>
                <p className="mt-1"><span className="text-muted-foreground">Student answer: </span>
                  {val === undefined || val === "" ? <span className="italic text-muted-foreground">No answer</span>
                    : isMCQ ? <span className={correct ? "text-success" : "text-destructive"}>{opts[Number(val)] ?? String(val)}</span>
                    : <span className="whitespace-pre-wrap">{String(val)}</span>}
                </p>
                {isMCQ ? (
                  <p className="mt-1 text-xs text-muted-foreground">Correct answer: {opts[q.correct_index]}</p>
                ) : q.answer_text ? (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">Model answer: {q.answer_text}</p>
                ) : null}
              </div>
            );
          })}
          {!questions.length && <p className="text-sm text-muted-foreground">No questions on this assessment.</p>}
        </div>
      )}

      {canGrade && (
      <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-[140px_1fr_auto] sm:items-end">
        <div>
          <Label className="text-xs">Score</Label>
          <div className="flex items-center gap-1">
            <Input type="number" className="w-20" value={score} onChange={(e) => setScore(Number(e.target.value))} />
            <span className="text-sm text-muted-foreground">/ {totalMarks}</span>
          </div>
        </div>
        <div>
          <Label className="text-xs">Feedback</Label>
          <Textarea rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </div>
        <Button size="sm" onClick={() => onSave(Number(score), feedback)}>Save</Button>
      </div>
      )}
    </div>
  );
}


/* -------------------- Materials -------------------- */

function MaterialsTab({ moduleId, materials, onChanged }: { moduleId: string; materials: any[]; onChanged: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const getUrl = useServerFn(getMaterialUrl);
  const doUpload = useServerFn(uploadMaterial);
  const doDelete = useServerFn(deleteMaterial);

  async function upload() {
    if (!file || !title) return toast.error("Title and file required");
    if (file.size > 25 * 1024 * 1024) return toast.error("File too large (max 25MB)");
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      // Chunked base64 to avoid call-stack overflow on large files
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      const fileBase64 = btoa(binary);
      await doUpload({ data: { moduleId, title, description, fileName: file.name, fileType: file.type, fileBase64 } });
      toast.success("Uploaded");
      setTitle(""); setDescription(""); setFile(null);
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploading(false); }
  }

  async function download(path: string) {
    const r = await getUrl({ data: { path } });
    window.open(r.url, "_blank");
  }

  const remove = useMutation({
    mutationFn: async (m: any) => {
      await doDelete({ data: { materialId: m.id } });
    },
    onSuccess: onChanged,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader><CardTitle>Uploaded materials</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Uploaded</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {materials.map(m => (
                <TableRow key={m.id}>
                  <TableCell><div className="font-medium">{m.title}</div><div className="text-xs text-muted-foreground">{m.description}</div></TableCell>
                  <TableCell className="text-muted-foreground">{m.file_type || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => download(m.file_path)}><Download className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete?")) remove.mutate(m); }}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!materials.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No materials.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Upload new</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><Label>File</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
          <Button className="w-full" onClick={upload} disabled={uploading}><FileUp className="mr-1 h-4 w-4" /> {uploading ? "Uploading…" : "Upload"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------- Attendance -------------------- */

function AttendanceTab({ moduleId, students }: { moduleId: string; students: any[] }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const qc = useQueryClient();
  const { data: records, refetch } = useQuery({
    queryKey: ["attendance", moduleId, date],
    queryFn: async () => (await supabase.from("attendance").select("*").eq("module_id", moduleId).eq("date", date)).data ?? [],
  });
  const byStudent = Object.fromEntries((records ?? []).map(r => [r.student_id, r]));

  const setStatus = useMutation({
    mutationFn: async ({ studentId, status }: { studentId: string; status: "present" | "absent" | "late" | "excused" }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("attendance").upsert({
        module_id: moduleId, student_id: studentId, date, status, marked_by: u.user?.id,
      }, { onConflict: "module_id,student_id,date" });
      if (error) throw error;
    },
    onSuccess: () => { refetch(); qc.invalidateQueries({ queryKey: ["attendance", moduleId, date] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance</CardTitle>
        <CardDescription>Mark attendance for a session.</CardDescription>
        <div className="pt-2"><Label>Date</Label><Input type="date" className="w-48" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {students.map(s => {
              const cur = byStudent[s.id]?.status ?? "";
              return (
                <TableRow key={s.id}>
                  <TableCell><div className="font-medium">{s.full_name || "—"}</div><div className="text-xs text-muted-foreground">{s.email}</div></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {(["present", "absent", "late", "excused"] as const).map(st => (
                        <Button key={st} size="sm" variant={cur === st ? "default" : "outline"} className="capitalize" onClick={() => setStatus.mutate({ studentId: s.id, status: st })}>{st}</Button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!students.length && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No students enrolled.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
