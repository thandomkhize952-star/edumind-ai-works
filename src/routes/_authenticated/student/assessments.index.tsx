import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/student/assessments/")({
  component: StudentAssessments,
});

function StudentAssessments() {
  const { data } = useQuery({
    queryKey: ["student-assessments"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data: enr } = await supabase.from("enrollments").select("qualification_id").eq("student_id", u.user.id);
      const qids = (enr ?? []).map(e => e.qualification_id);
      if (!qids.length) return [];
      const { data: mods } = await supabase.from("modules").select("id, code, title").in("qualification_id", qids);
      const mids = (mods ?? []).map(m => m.id);
      if (!mids.length) return [];
      const modById = Object.fromEntries((mods ?? []).map(m => [m.id, m]));
      const { data: a } = await supabase.from("assessments").select("*").in("module_id", mids).eq("published", true).order("due_at", { ascending: true });
      const { data: subs } = await supabase.from("submissions").select("*").eq("student_id", u.user.id);
      const subBy = Object.fromEntries((subs ?? []).map(s => [s.assessment_id, s]));
      return (a ?? []).map(x => ({ ...x, module: modById[x.module_id], submission: subBy[x.id] }));
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">Assessments</h1>
      {data?.length === 0 && <p className="text-muted-foreground">No published assessments yet.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {data?.map(a => (
          <Card key={a.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="capitalize">{a.type}</Badge>
                {a.submission && (a.submission.score != null
                  ? <Badge>{a.submission.score} / {a.total_marks}</Badge>
                  : <Badge variant="outline">Awaiting grade</Badge>)}
              </div>


              <CardTitle className="text-base">{a.title}</CardTitle>
              <CardDescription>{a.module?.code} — {a.module?.title}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{a.description || "—"}</p>
              {a.due_at && <p className="text-xs text-muted-foreground">Due {new Date(a.due_at).toLocaleString()}</p>}
              <Button asChild variant={a.submission ? "outline" : "default"} className="w-full">
                <Link to="/student/assessments/$id" params={{ id: a.id }}>{a.submission ? "Review" : "Start"}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
