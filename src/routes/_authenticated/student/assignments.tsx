import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Send, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/student/assignments")({
  component: StudentAssignments,
  head: () => ({
    meta: [
      { title: "Assignments — EduMind AI" },
      { name: "description", content: "Track posted, submitted, completed and pending assignments for your modules." },
      { property: "og:title", content: "Assignments — EduMind AI" },
      { property: "og:description", content: "Track posted, submitted, completed and pending assignments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

export function useStudentAssessments() {
  return useQuery({
    queryKey: ["student-assessments"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data: enr } = await supabase.from("enrollments").select("qualification_id").eq("student_id", u.user.id).eq("status", "approved");
      const qids = (enr ?? []).map((e) => e.qualification_id);
      if (!qids.length) return [];
      const { data: mods } = await supabase.from("modules").select("id, code, title").in("qualification_id", qids);
      const mids = (mods ?? []).map((m) => m.id);
      if (!mids.length) return [];
      const modById = Object.fromEntries((mods ?? []).map((m) => [m.id, m]));
      const { data: a } = await supabase
        .from("assessments")
        .select("*")
        .in("module_id", mids)
        .eq("published", true)
        .order("due_at", { ascending: true });
      const { data: subs } = await supabase.from("submissions").select("*").eq("student_id", u.user.id);
      const subBy = Object.fromEntries((subs ?? []).map((s) => [s.assessment_id, s]));
      return (a ?? []).map((x) => ({ ...x, module: modById[x.module_id], submission: subBy[x.id] }));
    },
  });
}

export function StatCard({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-xl bg-accent p-2.5 text-accent-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StudentAssignments() {
  const { data, isLoading } = useStudentAssessments();
  const items = (data ?? []).filter((a) => a.type === "assignment");

  const posted = items.length;
  const submitted = items.filter((a) => a.submission).length;
  const completed = items.filter((a) => a.submission && a.submission.score != null).length;
  const pending = posted - submitted;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Assignments</h1>
        <p className="text-muted-foreground">Your assignments across all enrolled modules.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileText} label="Posted" value={posted} />
        <StatCard icon={Send} label="Submitted" value={submitted} />
        <StatCard icon={CheckCircle2} label="Completed (graded)" value={completed} />
        <StatCard icon={Clock} label="Pending" value={pending} />
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && posted === 0 && <p className="text-muted-foreground">No assignments posted yet.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((a) => (
          <Card key={a.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="capitalize">{a.type}</Badge>
                {a.submission ? (
                  a.submission.score != null ? (
                    <Badge>{a.submission.score} / {a.total_marks}</Badge>
                  ) : (
                    <Badge variant="outline">Awaiting grade</Badge>
                  )
                ) : (
                  <Badge variant="outline">Pending</Badge>
                )}
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
