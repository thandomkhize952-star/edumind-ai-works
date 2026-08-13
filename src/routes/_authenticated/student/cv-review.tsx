import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Upload, Trash2, Eye, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHero } from "@/components/PageHero";
import { submitCv, listCvReviews, getCvUrl, deleteCvReview } from "@/lib/cv.functions";

export const Route = createFileRoute("/_authenticated/student/cv-review")({
  component: CvReview,
  head: () => ({
    meta: [
      { title: "CV Review | EduMind AI" },
      { name: "description", content: "Upload your CV and get instant AI-powered feedback, a score and improvement tips." },
      { property: "og:title", content: "CV Review | EduMind AI" },
      { property: "og:description", content: "Upload your CV and get instant AI-powered feedback, a score and improvement tips." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ACCEPT = ".pdf,.doc,.docx,.txt,image/*";
const MAX_BYTES = 10 * 1024 * 1024;

function CvReview() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const list = useServerFn(listCvReviews);
  const upload = useServerFn(submitCv);
  const sign = useServerFn(getCvUrl);
  const remove = useServerFn(deleteCvReview);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["cv-reviews"],
    queryFn: () => list(),
  });

  const submit = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_BYTES) throw new Error("File is too large (max 10MB)");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Could not read the file"));
        r.readAsDataURL(file);
      });
      return upload({
        data: { name: file.name, mimeType: file.type || "application/octet-stream", dataUrl },
      });
    },
    onSuccess: (r) => {
      toast.success("CV reviewed");
      setSelected(r.id);
      qc.invalidateQueries({ queryKey: ["cv-reviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Submission deleted");
      qc.invalidateQueries({ queryKey: ["cv-reviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function view(id: string) {
    try {
      const { url } = await sign({ data: { id } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open file");
    }
  }

  const reviewed = reviews.filter((r) => r.status === "reviewed");
  const best = reviewed.reduce<number | null>((m, r) => (r.score != null && (m == null || r.score > m) ? r.score : m), null);
  const active = reviews.find((r) => r.id === selected) ?? reviews[0];

  return (
    <div className="space-y-6 p-6">
      <PageHero
        icon={FileText}
        title="CV Review"
        subtitle="Upload your CV and get instant AI feedback, a score and practical improvements."
        stats={[
          { label: "Submissions", value: reviews.length },
          { label: "Reviewed", value: reviewed.length },
          { label: "Best score", value: best != null ? `${best}%` : "—" },
        ]}
        action={
          <>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) submit.mutate(f);
              }}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={submit.isPending}>
              {submit.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reviewing…</>
              ) : (
                <><Upload className="mr-2 h-4 w-4" /> Upload CV</>
              )}
            </Button>
          </>
        }
      />

      {active && (
        <Card className="border-border/50 bg-card/60 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" /> Latest review
            </CardTitle>
            <div className="flex items-center gap-3">
              {active.score != null && (
                <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-bold text-primary">{active.score}%</span>
              )}
              <Button size="sm" variant="outline" onClick={() => view(active.id)}>
                <Eye className="mr-2 h-4 w-4" /> View file
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {active.file_name} · {new Date(active.created_at).toLocaleDateString()}
            </div>
            {active.summary && <p className="font-medium">{active.summary}</p>}
            <pre className="whitespace-pre-wrap break-words rounded-xl bg-muted/40 p-4 text-sm leading-relaxed">
              {active.feedback ?? "No feedback yet."}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 bg-card/60 backdrop-blur">
        <CardHeader><CardTitle className="text-lg">All submissions</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && reviews.length === 0 && (
            <p className="text-sm text-muted-foreground">No CVs submitted yet. Upload one to get started.</p>
          )}
          {reviews.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/40 p-3"
            >
              <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => setSelected(r.id)}>
                <span className="rounded-lg bg-primary/15 p-2"><FileText className="h-4 w-4 text-primary" /></span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.file_name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()} · {r.status}
                  </span>
                </span>
              </button>
              <div className="flex items-center gap-2">
                {r.score != null && <span className="text-sm font-semibold">{r.score}%</span>}
                <Button size="sm" variant="ghost" onClick={() => view(r.id)}><Eye className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
