import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyTranscript } from "@/lib/reports.functions";
import { csvRows, downloadCsv } from "@/lib/csv";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student/marks")({
  component: MyMarks,
});

function TranscriptButton() {
  const fetchTranscript = useServerFn(getMyTranscript);
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const t = await fetchTranscript();
      const rows: unknown[][] = [
        ["EduMind AI — Academic Transcript"],
        ["Student", t.student.full_name],
        ["Student number", t.student.student_number],
        ["Email", t.student.email],
        ["Generated at", new Date(t.generated_at).toLocaleString()],
        ["Overall average", t.overall_percent === null ? "N/A" : `${t.overall_percent}%`],
        [],
      ];
      for (const q of t.qualifications) {
        rows.push([`Qualification: ${q.code} — ${q.title}`]);
        rows.push(["Qualification overall", q.percent === null ? "N/A" : `${q.percent}%`, "Marks", `${q.marks_earned} / ${q.marks_possible}`]);
        rows.push(["Module code", "Module title", "Assessments", "Completed", "Marks earned", "Marks possible", "Module overall"]);
        for (const m of q.modules) {
          rows.push([m.code, m.title, m.assessments, m.completed, m.marks_earned, m.marks_possible, m.percent === null ? "N/A" : `${m.percent}%`]);
        }
        rows.push([]);
      }
      downloadCsv(`edumind-transcript-${new Date().toISOString().slice(0, 10)}.csv`, csvRows(rows));
      toast.success("Transcript downloaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={download} disabled={busy} className="gap-2">
      <Download className="h-4 w-4" /> {busy ? "Preparing…" : "Download transcript"}
    </Button>
  );
}


function MyMarks() {
  const { data } = useQuery({
    queryKey: ["my-marks"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { subs: [], attendance: [] };
      const { data: subs } = await supabase.from("submissions").select("*, assessments(title, type, total_marks, module_id)").eq("student_id", u.user.id).order("submitted_at", { ascending: false });
      const moduleIds = Array.from(new Set((subs ?? []).map(s => s.assessments?.module_id).filter(Boolean) as string[]));
      const { data: mods } = moduleIds.length ? await supabase.from("modules").select("id, code, title").in("id", moduleIds) : { data: [] };
      const modById = Object.fromEntries((mods ?? []).map(m => [m.id, m]));
      const enriched = (subs ?? []).map(s => ({ ...s, module: s.assessments ? modById[s.assessments.module_id] : null }));
      return { subs: enriched };
    },
  });

  const subs = data?.subs ?? [];
  const avg = subs.length ? Math.round(subs.reduce((acc, s) => acc + (Number(s.score ?? 0) / Number(s.assessments?.total_marks || 1)) * 100, 0) / subs.length) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">My Marks</h1>
        <TranscriptButton />
      </div>
      <Card>
        <CardHeader><CardTitle>Average: {avg}%</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Module</TableHead><TableHead>Assessment</TableHead><TableHead>Type</TableHead><TableHead>Score</TableHead><TableHead>Submitted</TableHead></TableRow></TableHeader>
            <TableBody>
              {subs.map(s => (
                <TableRow key={s.id}>
                  <TableCell>{s.module?.code}</TableCell>
                  <TableCell>{s.assessments?.title}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{s.assessments?.type}</Badge></TableCell>
                  <TableCell className="font-medium">{s.score} / {s.assessments?.total_marks}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(s.submitted_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {!subs.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No submissions yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
