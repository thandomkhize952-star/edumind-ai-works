import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMaterialUrl } from "@/lib/storage.functions";
import { getModuleLecturers } from "@/lib/modules.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, FileText, ClipboardList, CalendarCheck, Award, Download, BookOpen } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student/modules/$moduleId")({
  component: ModuleDetail,
});

function ModuleDetail() {
  const { moduleId } = useParams({ from: "/_authenticated/student/modules/$moduleId" });
  const signUrl = useServerFn(getMaterialUrl);
  const fetchLecturers = useServerFn(getModuleLecturers);

  const { data, isLoading } = useQuery({
    queryKey: ["student-module", moduleId],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;

      const [modRes, matRes, asmRes, attRes, lecRes] = await Promise.all([
        supabase.from("modules").select("id, code, title, description, qualification_id, lecturer_id, qualifications(code, title)").eq("id", moduleId).maybeSingle(),
        supabase.from("materials").select("id, title, description, file_path, file_type, created_at").eq("module_id", moduleId).order("created_at", { ascending: false }),
        supabase.from("assessments").select("id, title, type, total_marks, due_at, published, created_at").eq("module_id", moduleId).eq("published", true).order("created_at", { ascending: false }),
        uid ? supabase.from("attendance").select("date, status").eq("module_id", moduleId).eq("student_id", uid).order("date", { ascending: false }) : Promise.resolve({ data: [] as any[] }),
        Promise.resolve(null),
      ]);

      const assessments = asmRes.data ?? [];
      const asmIds = assessments.map((a) => a.id);
      const { data: subs } = uid && asmIds.length
        ? await supabase.from("submissions").select("assessment_id, score, submitted_at, graded_at, feedback").eq("student_id", uid).in("assessment_id", asmIds)
        : { data: [] as any[] };

      // lecturer profile (resolved server-side; profiles are RLS-protected)
      let lecturer: { full_name: string | null; email: string | null } | null = null;
      try {
        const map = await fetchLecturers({ data: { moduleIds: [moduleId] } });
        lecturer = map?.[moduleId] ?? null;
      } catch {
        lecturer = null;
      }


      const subByAsm = Object.fromEntries((subs ?? []).map((s) => [s.assessment_id, s]));
      const att = attRes.data ?? [];
      const present = att.filter((a) => a.status === "present" || a.status === "late").length;
      const attPct = att.length ? Math.round((present / att.length) * 100) : 0;

      // marks summary
      const graded = assessments
        .map((a) => ({ a, s: subByAsm[a.id] }))
        .filter((x) => x.s && x.s.score !== null);
      const avgPct = graded.length
        ? Math.round(graded.reduce((sum, x) => sum + (Number(x.s.score) / Number(x.a.total_marks || 1)) * 100, 0) / graded.length)
        : 0;

      return { module: modRes.data, lecturer, materials: matRes.data ?? [], assessments, subByAsm, attendance: att, attPct, avgPct };
    },
  });

  async function openMaterial(path: string) {
    try {
      const res = await signUrl({ data: { path } });
      window.open(res.url, "_blank", "noopener");
    } catch (e: any) {
      toast.error(e?.message || "Could not open material");
    }
  }

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading module…</div>;
  if (!data?.module) return <div className="p-6">Module not found.</div>;

  const m = data.module;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/student/courses/$qualId" params={{ qualId: m.qualification_id }}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to modules
        </Link>
      </Button>

      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" /> {m.qualifications?.code} — {m.qualifications?.title}
        </div>
        <h1 className="text-3xl font-bold">{m.code} — {m.title}</h1>
        {m.description && <p className="text-muted-foreground">{m.description}</p>}
        <p className="text-sm text-muted-foreground">
          Lecturer: {data.lecturer?.full_name || data.lecturer?.email || "Unassigned"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={FileText} label="Materials" value={String(data.materials.length)} />
        <StatCard icon={ClipboardList} label="Assessments" value={String(data.assessments.length)} />
        <StatCard icon={Award} label="Average Mark" value={`${data.avgPct}%`} progress={data.avgPct} />
        <StatCard icon={CalendarCheck} label="Attendance" value={`${data.attPct}%`} progress={data.attPct} />
      </div>

      <Tabs defaultValue="materials">
        <TabsList>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="marks">My Marks</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="materials" className="space-y-3">
          {data.materials.length === 0 && <p className="text-muted-foreground">No materials uploaded yet.</p>}
          {data.materials.map((mat) => (
            <Card key={mat.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-medium">{mat.title}</div>
                  {mat.description && <div className="text-sm text-muted-foreground">{mat.description}</div>}
                  <div className="text-xs text-muted-foreground">{new Date(mat.created_at).toLocaleString()}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => openMaterial(mat.file_path)}>
                  <Download className="mr-2 h-4 w-4" /> Open
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="assessments" className="space-y-3">
          {data.assessments.length === 0 && <p className="text-muted-foreground">No published assessments yet.</p>}
          {data.assessments.map((a) => {
            const sub = data.subByAsm[a.id];
            return (
              <Card key={a.id}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{a.title}</span>
                      <Badge variant="secondary" className="capitalize">{a.type}</Badge>
                      {sub ? (
                        sub.graded_at ? <Badge>Graded</Badge> : <Badge variant="outline">Submitted</Badge>
                      ) : <Badge variant="outline">Not started</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {a.total_marks} marks{a.due_at ? ` · Due ${new Date(a.due_at).toLocaleString()}` : ""}
                    </div>
                  </div>
                  {!sub ? (
                    <Button asChild size="sm">
                      <Link to="/student/assessments/$id" params={{ id: a.id }}>Take</Link>
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/student/assessments/$id" params={{ id: a.id }}>View</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="marks" className="space-y-3">
          {data.assessments.filter((a) => data.subByAsm[a.id]).length === 0 && (
            <p className="text-muted-foreground">No marks recorded yet.</p>
          )}
          {data.assessments.map((a) => {
            const sub = data.subByAsm[a.id];
            if (!sub) return null;
            const pct = sub.score !== null ? Math.round((Number(sub.score) / Number(a.total_marks || 1)) * 100) : null;
            return (
              <Card key={a.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{a.title}</div>
                    <div className="text-sm">
                      {sub.score !== null ? `${sub.score} / ${a.total_marks} (${pct}%)` : "Awaiting grade"}
                    </div>
                  </div>
                  {pct !== null && <Progress value={pct} className="h-1.5" />}
                  {sub.feedback && <div className="text-sm text-muted-foreground">Feedback: {sub.feedback}</div>}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="attendance" className="space-y-3">
          {data.attendance.length === 0 && <p className="text-muted-foreground">No attendance records yet.</p>}
          {data.attendance.map((r, i) => (
            <Card key={i}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="font-medium">{new Date(r.date).toLocaleDateString()}</div>
                <Badge variant={r.status === "present" ? "default" : r.status === "late" ? "secondary" : "destructive"} className="capitalize">
                  {r.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, progress }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; progress?: number }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-accent p-2 text-accent-foreground"><Icon className="h-5 w-5" /></div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {typeof progress === "number" && <Progress value={progress} className="h-1.5" />}
      </CardContent>
    </Card>
  );
}
