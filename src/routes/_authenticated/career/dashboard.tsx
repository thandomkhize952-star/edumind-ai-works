import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Clock, CheckCircle2, FileText, ArrowRight, Lightbulb, LineChart, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listAdvisorReviews, type AdvisorReview } from "@/lib/career.functions";
import { CvReviewDialog } from "@/components/CvReviewDialog";
import { getCurrentUserContext } from "@/lib/user.functions";

export const Route = createFileRoute("/_authenticated/career/dashboard")({
  component: CareerDashboard,
  head: () => ({
    meta: [
      { title: "Career Advisor Dashboard | EduMind AI" },
      { name: "description", content: "Review student CV submissions, track pending reviews and share career feedback." },
      { property: "og:title", content: "Career Advisor Dashboard | EduMind AI" },
      { property: "og:description", content: "Review student CV submissions, track pending reviews and share career feedback." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "S";
}

function fmt(d: string) {
  const date = new Date(d);
  return {
    day: date.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }),
    time: date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  };
}

function StatCard({
  icon: Icon,
  tag,
  tagClass,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Clock;
  tag: string;
  tagClass: string;
  label: string;
  value: number;
  hint: string;
  tone: string;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className={`text-xs font-medium ${tagClass}`}>{tag}</span>
      </div>
      <div className="mt-5 text-sm text-muted-foreground">{label}</div>
      <div className="text-4xl font-bold leading-tight">{value}</div>
      <div className="mt-2 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function CareerDashboard() {
  const fetchCtx = useServerFn(getCurrentUserContext);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => fetchCtx() });
  const name = (me?.profile?.full_name || "Advisor").split(" ")[0];

  const fetchReviews = useServerFn(listAdvisorReviews);
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["advisor-reviews", "all"],
    queryFn: () => fetchReviews({ data: { status: "all" } }),
  });
  const [active, setActive] = useState<AdvisorReview | null>(null);

  const pending = all.filter((r) => r.advisor_status !== "reviewed");
  const reviewed = all.filter((r) => r.advisor_status === "reviewed");

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Career Advisor Dashboard</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-success" /> Welcome back, {name}! Ready to review?
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={Clock}
          tag="Needs Attention"
          tagClass="text-warning"
          tone="bg-warning/15 text-warning"
          label="Pending Reviews"
          value={pending.length}
          hint="Awaiting your feedback"
        />
        <StatCard
          icon={CheckCircle2}
          tag="Completed"
          tagClass="text-success"
          tone="bg-success/15 text-success"
          label="Reviewed"
          value={reviewed.length}
          hint="Successfully processed"
        />
        <StatCard
          icon={FileText}
          tag="All Time"
          tagClass="text-primary"
          tone="bg-primary/15 text-primary"
          label="Total Reviews"
          value={all.length}
          hint="Cumulative count"
        />
      </div>

      <section className="glass rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-warning/15 text-warning">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Pending CV Reviews</div>
              <div className="text-xs text-muted-foreground">Student submissions awaiting feedback</div>
            </div>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link to="/career/reviews" search={{ status: "reviewed" }}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> View Reviewed <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                <th className="pb-3 font-semibold">Student</th>
                <th className="pb-3 font-semibold">Document</th>
                <th className="pb-3 font-semibold">Submitted</th>
                <th className="pb-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading && (
                <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && pending.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No pending submissions. Great work!</td></tr>
              )}
              {pending.map((r) => {
                const d = fmt(r.created_at);
                return (
                  <tr key={r.id}>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-primary-foreground">
                          {initials(r.student_name)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{r.student_name}</div>
                          <div className="truncate text-xs text-muted-foreground">{r.student_email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-destructive" />
                        <span className="truncate">{r.file_name}</span>
                      </span>
                    </td>
                    <td className="py-3">
                      <div>{d.day}</div>
                      <div className="text-xs text-muted-foreground">{d.time}</div>
                    </td>
                    <td className="py-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setActive(r)}>
                        <Eye className="mr-2 h-4 w-4" /> Review <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div className="font-semibold">Review Guidelines</div>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {["Check for clear formatting and structure", "Verify contact information accuracy", "Suggest relevant skills to highlight"].map((g) => (
              <li key={g} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" /> {g}
              </li>
            ))}
          </ul>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <LineChart className="h-5 w-5" />
            </div>
            <div className="font-semibold">Your Impact</div>
          </div>
          <div className="mt-5 grid grid-cols-3 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{reviewed.length}</div>
              <div className="mt-1 text-xs text-muted-foreground">Reviews Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-success">
                {all.length ? Math.round((reviewed.length / all.length) * 100) : 0}%
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Completion Rate</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-accent">{pending.length}</div>
              <div className="mt-1 text-xs text-muted-foreground">In Queue</div>
            </div>
          </div>
        </div>
      </div>

      <CvReviewDialog review={active} onClose={() => setActive(null)} />
    </div>
  );
}
