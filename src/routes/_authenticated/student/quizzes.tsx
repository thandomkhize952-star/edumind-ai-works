import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHero } from "@/components/PageHero";
import { HelpCircle, Search, Clock, CalendarDays, ShieldCheck, Eye, Trophy, Play } from "lucide-react";
import { useStudentAssessments } from "./assignments";

export const Route = createFileRoute("/_authenticated/student/quizzes")({
  component: StudentQuizzes,
  head: () => ({
    meta: [
      { title: "Quizzes — EduMind AI" },
      { name: "description", content: "See every quiz, test and exam for your modules and how many you have completed." },
      { property: "og:title", content: "Quizzes — EduMind AI" },
      { property: "og:description", content: "See every quiz for your modules and how many you have completed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function InfoTile({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/40 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function StudentQuizzes() {
  const { data, isLoading } = useStudentAssessments();
  const [q, setQ] = useState("");

  const items = (data ?? []).filter((a) => a.type === "quiz" || a.type === "test" || a.type === "exam");
  const total = items.length;
  const completed = items.filter((a) => a.submission).length;
  const graded = items.filter((a) => a.submission?.score != null).length;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((a) =>
      [a.title, a.module?.code, a.module?.title, a.type].filter(Boolean).some((s: any) => String(s).toLowerCase().includes(term)),
    );
  }, [items, q]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHero
        icon={HelpCircle}
        title="My Quizzes"
        subtitle="Take published quizzes from your enrolled modules and track your results."
        action={
          <div className="w-full sm:w-80">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search quizzes…"
                className="h-11 rounded-xl bg-secondary/50 pl-9"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Search by quiz title, module, or course</p>
          </div>
        }
        stats={[
          { label: "Available", value: total, tone: "primary" },
          { label: "Attempted", value: completed, tone: "accent" },
          { label: "Results out", value: graded, tone: "success" },
          { label: "Not attempted", value: total - completed, tone: "warning" },
        ]}
      />

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && total === 0 && <p className="text-muted-foreground">No quizzes published yet.</p>}
      {!isLoading && total > 0 && filtered.length === 0 && (
        <p className="text-muted-foreground">No quizzes match “{q}”.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((a) => {
          const limit = (a as any).time_limit_minutes as number | null;
          const attempted = Boolean(a.submission);
          return (
            <Card
              key={a.id}
              className="glass group border-border/60 transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10"
            >
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-md shadow-primary/25">
                      <HelpCircle className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">{a.title}</h3>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.module?.title} • {a.module?.code}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-success/30 bg-success/15 px-2.5 py-0.5 text-[11px] font-medium text-success">
                    {a.submission?.score != null ? `${a.submission.score} / ${a.total_marks}` : `${a.total_marks} marks`}
                  </span>
                </div>

                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {a.description || "No description provided."}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <InfoTile icon={Clock} label="Time limit" value={limit ? `${limit} min` : "No limit"} />
                  <InfoTile
                    icon={CalendarDays}
                    label="Due"
                    value={a.due_at ? new Date(a.due_at).toLocaleDateString(undefined, { month: "short", day: "2-digit" }) : "—"}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" /> Auto-graded
                  </span>
                  <Link
                    to="/student/assessments/$id"
                    params={{ id: a.id }}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                      attempted
                        ? "border-warning/30 bg-warning/10 text-warning hover:bg-warning/20"
                        : "border-primary/25 bg-primary/10 text-primary hover:bg-primary/20"
                    }`}
                  >
                    {attempted ? (
                      a.submission?.score != null ? (
                        <><Trophy className="h-4 w-4" /> Results</>
                      ) : (
                        <><Eye className="h-4 w-4" /> View only</>
                      )
                    ) : (
                      <><Play className="h-4 w-4" /> Start quiz</>
                    )}
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
