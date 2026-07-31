import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAssessmentForStudent, submitAssessment } from "@/lib/assessments.functions";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student/assessments/$id")({
  component: TakeAssessment,
});

function TakeAssessment() {
  const { id } = Route.useParams();
  const get = useServerFn(getAssessmentForStudent);
  const submit = useServerFn(submitAssessment);
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["assessment", id], queryFn: () => get({ data: { assessmentId: id } }) });
  const [answers, setAnswers] = useState<Record<string, number | string>>({});

  const m = useMutation({
    mutationFn: () => submit({ data: { assessmentId: id, answers } }),
    onSuccess: (r) => {
      if (r.autoGraded) toast.success(`Submitted! Score: ${r.score}`);
      else toast.success("Submitted! Your lecturer will grade this shortly.");
      qc.invalidateQueries();
      nav({ to: "/student/assessments" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
  const submitted = !!data.submission;
  const autoGrade = data.assessment.type === "quiz" || data.assessment.type === "test";
  const savedAnswers = (data.submission?.answers ?? {}) as Record<string, number | string>;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>{data.assessment.title}</CardTitle>
          <CardDescription className="capitalize">
            {data.assessment.type} · {data.assessment.total_marks} marks · {autoGrade ? "Auto-marked" : "Marked by lecturer"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{data.assessment.description || "—"}</p>
          {submitted && autoGrade && (
            <p className="mt-2 rounded-md bg-success/10 p-3 text-sm text-success">
              You scored {data.submission!.score} / {data.assessment.total_marks}
            </p>
          )}
          {submitted && !autoGrade && (
            <p className="mt-2 rounded-md bg-muted p-3 text-sm">
              {data.submission!.score != null
                ? `Graded: ${data.submission!.score} / ${data.assessment.total_marks}`
                : "Submitted — awaiting your lecturer's grading."}
            </p>
          )}
        </CardContent>
      </Card>

      {data.questions.map((q, i) => {
        const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
        const isMCQ = opts.length > 0;
        const currentVal = submitted ? savedAnswers[q.id] : answers[q.id];
        return (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="text-base">Q{i + 1}. {q.question}</CardTitle>
              <CardDescription>{q.marks} marks</CardDescription>
            </CardHeader>
            <CardContent>
              {isMCQ ? (
                <RadioGroup
                  disabled={submitted}
                  value={currentVal !== undefined ? String(currentVal) : ""}
                  onValueChange={(v) => setAnswers(a => ({ ...a, [q.id]: Number(v) }))}
                >
                  {opts.map((o, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-md border p-3">
                      <RadioGroupItem value={String(idx)} id={`${q.id}-${idx}`} />
                      <Label htmlFor={`${q.id}-${idx}`} className="cursor-pointer">{o}</Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <Textarea
                  disabled={submitted}
                  placeholder="Type your answer…"
                  value={currentVal !== undefined ? String(currentVal) : ""}
                  onChange={(e) => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                  rows={5}
                />
              )}
            </CardContent>
          </Card>
        );
      })}

      {!submitted && (
        <div className="space-y-2">
          {!autoGrade && (
            <Badge variant="secondary" className="w-full justify-center py-2">
              This {data.assessment.type} will be graded by your lecturer.
            </Badge>
          )}
          <Button size="lg" className="w-full" disabled={m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "Submitting…" : "Submit"}
          </Button>
        </div>
      )}
    </div>
  );
}
