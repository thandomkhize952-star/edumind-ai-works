import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { PageHero } from "@/components/PageHero";
import { FileText, Send, CheckCircle2, Clock, CalendarDays, Award, ArrowRight, ClipboardList } from "lucide-react";

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
    <Card className="glass border-border/60">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-xl bg-gradient-to-br from-primary to-accent p-2.5 text-primary-foreground shadow-md shadow-primary/20">
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

function statusOf(a: { due_at: string | null; submission?: { score: number | null } | null }) {
  if (a.submission) {
    return a.submission.score != null
      ? { label: "Graded", tone: "success" as const }
      : { label: "Submitted", tone: "primary" as const };
  }
  if (a.due_at && new Date(a.due_at) < new Date()) return { label: "Overdue", tone: "destructive" as const };
  return { label: "Pending", tone: "warning" as const };
}

const toneStyles = {
  success: { badge: "bg-success/15 text-success border-success/30", bar: "bg-success" },
  primary: { badge: "bg-primary/15 text-primary border-primary/30", bar: "bg-primary" },
  warning: { badge: "bg-warning/15 text-warning border-warning/30", bar: "bg-warning" },
  destructive: { badge: "bg-destructive/15 text-destructive border-destructive/30", bar: "bg-destructive" },
};

function StudentAssignments() {
  const { data, isLoading } = useStudentAssessments();
  const items = (data ?? []).filter((a) => a.type === "assignment");

  const posted = items.length;
  const submitted = items.filter((a) => a.submission).length;
  const completed = items.filter((a) => a.submission && a.submission.score != null).length;
  const pending = posted - submitted;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHero
        icon={ClipboardList}
        title="My Assignments"
        subtitle="View and submit assignments from your enrolled modules"
        stats={[
          { label: "Total", value: posted },
          { label: "Pending", value: pending, tone: "warning" },
          { label: "Submitted", value: submitted, tone: "primary" },
          { label: "Graded", value: completed, tone: "success" },
        ]}
      />

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && posted === 0 && <p className="text-muted-foreground">No assignments posted yet.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((a) => {
          const st = statusOf(a);
          const styles = toneStyles[st.tone];
          return (
            <Card key={a.id} className="glass group overflow-hidden border-border/60 pt-0 transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10">
              <div className={`h-1 w-full ${styles.bar}`} />
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{a.title}</h3>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.module?.code} — {a.module?.title}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${styles.badge}`}>
                    {st.label}
                  </span>
                </div>

                <p className="line-clamp-2 text-sm text-muted-foreground">{a.description || "Submit your work for this module."}</p>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {a.due_at && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/60 px-2.5 py-1 text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" /> Due {new Date(a.due_at).toLocaleString()}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/60 px-2.5 py-1 text-muted-foreground">
                    <Award className="h-3.5 w-3.5" />
                    {a.submission?.score != null ? `${a.submission.score} / ${a.total_marks}` : `${a.total_marks} marks`}
                  </span>
                </div>

                <Link
                  to="/student/assessments/$id"
                  params={{ id: a.id }}
                  className="flex items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/10 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  {a.submission ? "Review submission" : "Open assignment"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export const AssignmentIcons = { FileText, Send, CheckCircle2, Clock };
