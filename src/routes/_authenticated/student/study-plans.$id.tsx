import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getStudyPlan, updateTaskStatus, type StudyPlanTask } from "@/lib/study-plans.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, BookMarked, BookOpen, CheckCircle2, Circle, Clock, Flag, CalendarDays,
  Hourglass, LineChart, Lightbulb, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/student/study-plans/$id")({
  component: StudyPlanDetail,
  head: () => ({
    meta: [
      { title: "Study Plan | EduMind AI" },
      { name: "description", content: "Track tasks, progress and study tips for your AI-generated study plan." },
      { property: "og:title", content: "Study Plan | EduMind AI" },
      { property: "og:description", content: "Track tasks, progress and study tips for your AI-generated study plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const priorityStyles: Record<string, string> = {
  low: "text-sky-400",
  medium: "text-amber-400",
  high: "text-rose-400",
};

function statusBadge(status: string) {
  if (status === "completed")
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> Completed
      </span>
    );
  if (status === "in_progress")
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs text-primary">
        <Hourglass className="h-3.5 w-3.5" /> In Progress
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
      <Circle className="h-3.5 w-3.5" /> Pending
    </span>
  );
}

function StudyPlanDetail() {
  const { id } = Route.useParams();
  const get = useServerFn(getStudyPlan);
  const setStatus = useServerFn(updateTaskStatus);
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ["study-plan", id], queryFn: () => get({ data: { planId: id } }) });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["study-plan", id] });
    qc.invalidateQueries({ queryKey: ["study-plans"] });
  };

  const toggle = useMutation({
    mutationFn: (t: StudyPlanTask) =>
      setStatus({ data: { taskId: t.id, status: t.status === "completed" ? "pending" : "completed" } }),
    onSuccess: invalidate,
  });

  const setTaskStatus = useMutation({
    mutationFn: (v: { taskId: string; status: "pending" | "in_progress" | "completed" }) =>
      setStatus({ data: v }),
    onSuccess: invalidate,
  });

  if (!data) return <div className="p-6 text-sm text-muted-foreground">Loading study plan…</div>;

  const tasks = data.tasks;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const pending = tasks.filter((t) => t.status === "pending").length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 1000) / 10 : 0;
  const remaining = tasks.filter((t) => t.status !== "completed").reduce((s, t) => s + t.duration_minutes, 0);

  return (
    <div className="space-y-5 p-6">
      <Button asChild variant="outline" size="sm">
        <Link to="/student/study-plans"><ArrowLeft className="mr-2 h-4 w-4" /> Back to study plans</Link>
      </Button>

      <Card className="glass">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-gradient-to-br from-primary to-accent p-2.5">
                <BookMarked className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{data.plan.title}</h1>
                {data.qualificationTitle && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <BookOpen className="h-4 w-4" /> {data.qualificationTitle}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{progress}% <span className="text-base font-normal text-muted-foreground">Complete</span></div>
              <div className="flex items-center justify-end gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> {completed} of {tasks.length} tasks done
              </div>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${progress}%` }} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {tasks.map((t) => (
            <Card key={t.id} className={cn("glass", t.status === "completed" && "border-emerald-500/30")}>
              <CardContent className="flex items-start gap-3 p-4">
                <Checkbox
                  checked={t.status === "completed"}
                  onCheckedChange={() => toggle.mutate(t)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className={cn("font-semibold", t.status === "completed" && "line-through text-muted-foreground")}>
                      {t.title}
                    </div>
                    {statusBadge(t.status)}
                  </div>
                  {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {t.duration_minutes} min</span>
                    <span className={cn("flex items-center gap-1.5 capitalize", priorityStyles[t.priority])}>
                      <Flag className="h-3.5 w-3.5" /> {t.priority} priority
                    </span>
                    {t.due_date && (
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Due {new Date(t.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-5">
          <Card className="glass">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2 font-semibold"><LineChart className="h-4 w-4 text-primary" /> Progress Stats</div>
              {[
                { label: "Completed", value: completed, icon: CheckCircle2, tone: "text-emerald-400" },
                { label: "In Progress", value: inProgress, icon: Hourglass, tone: "text-primary" },
                { label: "Pending", value: pending, icon: Circle, tone: "text-muted-foreground" },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                  <span className="flex items-center gap-2 text-sm"><s.icon className={cn("h-4 w-4", s.tone)} /> {s.label}</span>
                  <span className="text-lg font-semibold">{s.value}</span>
                </div>
              ))}
              <div className="flex items-center gap-3 border-t border-border/60 pt-3">
                <Clock className="h-5 w-5 text-amber-400" />
                <div>
                  <div className="text-xs text-muted-foreground">Estimated Time Remaining</div>
                  <div className="font-semibold">{remaining} minutes</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="space-y-2 p-5">
              <div className="flex items-center gap-2 font-semibold"><Lightbulb className="h-4 w-4 text-amber-400" /> Study Tips</div>
              {[
                "Break study sessions into 25-minute focused intervals",
                "Review completed items to reinforce learning",
                "Use AI Tutor for difficult concepts",
              ].map((tip) => (
                <div key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {tip}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
