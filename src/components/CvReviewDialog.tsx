import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eye, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { saveAdvisorReview, getAdvisorCvUrl, type AdvisorReview } from "@/lib/career.functions";

export function CvReviewDialog({
  review,
  onClose,
}: {
  review: AdvisorReview | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(saveAdvisorReview);
  const sign = useServerFn(getAdvisorCvUrl);
  const [feedback, setFeedback] = useState("");

  useEffect(() => setFeedback(review?.advisor_feedback ?? ""), [review?.id, review?.advisor_feedback]);

  const open = useMutation({
    mutationFn: async (id: string) => sign({ data: { id } }),
    onSuccess: (r) => window.open(r.url, "_blank", "noopener"),
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = useMutation({
    mutationFn: async (status: "reviewed" | "needs_revision") =>
      save({ data: { id: review!.id, advisorFeedback: feedback, advisorStatus: status } }),
    onSuccess: () => {
      toast.success("Review saved");
      qc.invalidateQueries({ queryKey: ["advisor-reviews"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!review} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{review?.student_name}</DialogTitle>
          <DialogDescription>{review?.file_name}</DialogDescription>
        </DialogHeader>

        {review && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="secondary" onClick={() => open.mutate(review.id)} disabled={open.isPending}>
                {open.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                Open document
              </Button>
              {review.score !== null && (
                <span className="text-sm text-muted-foreground">AI score: <span className="font-semibold text-foreground">{review.score}%</span></span>
              )}
            </div>

            {review.summary && (
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">{review.summary}</div>
            )}
            {review.feedback && (
              <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border/60 p-3 text-sm text-muted-foreground">
                {review.feedback}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="advisor-feedback">Your feedback</Label>
              <Textarea
                id="advisor-feedback"
                rows={6}
                placeholder="Share formatting, structure and content advice for this student…"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => submit.mutate("needs_revision")} disabled={submit.isPending}>
                Needs revision
              </Button>
              <Button onClick={() => submit.mutate("reviewed")} disabled={submit.isPending}>
                {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Mark as reviewed
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
