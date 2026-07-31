import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, CheckCircle2 } from "lucide-react";
import { useStudentAssessments, StatCard } from "./assignments";

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

function StudentQuizzes() {
  const { data, isLoading } = useStudentAssessments();
  const items = (data ?? []).filter((a) => a.type === "quiz" || a.type === "test" || a.type === "exam");

  const total = items.length;
  const completed = items.filter((a) => a.submission).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Quizzes</h1>
        <p className="text-muted-foreground">Quizzes, tests and exams across all enrolled modules.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard icon={ClipboardList} label="Quizzes available" value={total} />
        <StatCard icon={CheckCircle2} label="Quizzes completed" value={completed} />
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && total === 0 && <p className="text-muted-foreground">No quizzes published yet.</p>}

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
                  <Badge variant="outline">Not attempted</Badge>
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
