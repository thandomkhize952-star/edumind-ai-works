import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Briefcase, CheckCircle2, Search, Hourglass, AlertCircle, Eye, Flag, Sparkles, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listAdvisorReviews, type AdvisorReview } from "@/lib/career.functions";
import { CvReviewDialog } from "@/components/CvReviewDialog";

const searchSchema = z.object({
  status: z.enum(["all", "pending", "reviewed"]).default("all"),
});

export const Route = createFileRoute("/_authenticated/career/reviews")({
  validateSearch: searchSchema,
  component: ReviewQueue,
  head: () => ({
    meta: [
      { title: "CV Review Queue | EduMind AI" },
      { name: "description", content: "Browse, filter and complete student CV reviews from one queue." },
      { property: "og:title", content: "CV Review Queue | EduMind AI" },
      { property: "og:description", content: "Browse, filter and complete student CV reviews from one queue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "S";
}
const shortDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });

function Stat({ icon: Icon, value, label, tone }: { icon: typeof Briefcase; value: number; label: string; tone: string }) {
  return (
    <div className="glass flex items-center gap-4 rounded-2xl p-5">
      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-3xl font-bold leading-none">{value}</div>
        <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function ReviewQueue() {
  const { status } = Route.useSearch();
  const navigate = Route.useNavigate();
  const fetchReviews = useServerFn(listAdvisorReviews);
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["advisor-reviews", "all"],
    queryFn: () => fetchReviews({ data: { status: "all" } }),
  });

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [active, setActive] = useState<AdvisorReview | null>(null);

  const reviewed = all.filter((r) => r.advisor_status === "reviewed");
  const needsRevision = all.filter((r) => r.advisor_status === "needs_revision");
  const pending = all.filter((r) => r.advisor_status === "pending");

  const list = useMemo(() => {
    let rows = all;
    if (status === "reviewed") rows = reviewed;
    if (status === "pending") rows = all.filter((r) => r.advisor_status !== "reviewed");
    const term = q.trim().toLowerCase();
    if (term) rows = rows.filter((r) => r.student_name.toLowerCase().includes(term) || r.id.includes(term));
    return [...rows].sort((a, b) =>
      sort === "newest"
        ? +new Date(b.created_at) - +new Date(a.created_at)
        : +new Date(a.created_at) - +new Date(b.created_at),
    );
  }, [all, reviewed, status, q, sort]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button asChild size="icon" variant="secondary" className="rounded-xl">
          <Link to="/career/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">CV Review Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">All student CV submissions in one place</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Briefcase} value={all.length} label="Total reviews" tone="bg-primary/15 text-primary" />
        <Stat icon={Hourglass} value={pending.length} label="Pending" tone="bg-warning/15 text-warning" />
        <Stat icon={CheckCircle2} value={reviewed.length} label="Reviewed" tone="bg-success/15 text-success" />
        <Stat icon={AlertCircle} value={needsRevision.length} label="Needs revision" tone="bg-destructive/15 text-destructive" />
      </div>

      <div className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by student name or review ID…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={status}
          onChange={(e) => navigate({ search: { status: e.target.value as "all" | "pending" | "reviewed" } })}
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading reviews…</p>}
      {!isLoading && list.length === 0 && <p className="text-muted-foreground">No reviews match this filter.</p>}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {list.map((r) => {
          const done = r.advisor_status === "reviewed";
          const score = r.score ?? 0;
          return (
            <div key={r.id} className="glass flex flex-col rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-primary-foreground">
                  {initials(r.student_name)}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{r.student_name}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.student_email}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${score >= 75 ? "bg-success" : score >= 50 ? "bg-primary" : "bg-warning"}`}
                    style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                  />
                </div>
                <span className={`text-sm font-semibold ${score >= 75 ? "text-success" : "text-warning"}`}>
                  {r.score === null ? "—" : `${score.toFixed(1)}%`}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Submitted {shortDate(r.created_at)}</span>
                {r.reviewed_at ? (
                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Reviewed {shortDate(r.reviewed_at)}</span>
                ) : (
                  <span className="flex items-center gap-1 text-warning"><AlertCircle className="h-3.5 w-3.5" /> Awaiting review</span>
                )}
              </div>

              <div className="mt-4 rounded-xl border border-success/25 bg-success/5 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-success"><Sparkles className="h-3.5 w-3.5" /> Key insight</div>
                <p className="mt-1 line-clamp-2 text-sm">{r.summary || "AI summary not available yet."}</p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${done ? "bg-success/15 text-success" : r.advisor_status === "needs_revision" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>
                  {done ? "Reviewed" : r.advisor_status === "needs_revision" ? "Needs revision" : "Pending"}
                </span>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setActive(r)} title="Open review">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setActive(r)} title="Flag / add feedback">
                    <Flag className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <CvReviewDialog review={active} onClose={() => setActive(null)} />
    </div>
  );
}
