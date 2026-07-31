import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMaterialUrl } from "@/lib/storage.functions";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student/materials")({
  component: StudentMaterials,
  head: () => ({
    meta: [
      { title: "Study Materials — EduMind AI" },
      { name: "description", content: "All lecture notes, slides and resources across every module you are enrolled in." },
      { property: "og:title", content: "Study Materials — EduMind AI" },
      { property: "og:description", content: "All lecture notes, slides and resources for your modules." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function StudentMaterials() {
  const signUrl = useServerFn(getMaterialUrl);

  const { data, isLoading } = useQuery({
    queryKey: ["student-all-materials"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data: enr } = await supabase.from("enrollments").select("qualification_id").eq("student_id", u.user.id);
      const qids = (enr ?? []).map((e) => e.qualification_id);
      if (!qids.length) return [];
      const { data: mods } = await supabase.from("modules").select("id, code, title").in("qualification_id", qids).order("code");
      const mids = (mods ?? []).map((m) => m.id);
      if (!mids.length) return [];
      const { data: mats } = await supabase
        .from("materials")
        .select("id, module_id, title, description, file_path, file_type, created_at")
        .in("module_id", mids)
        .order("created_at", { ascending: false });
      return (mods ?? []).map((m) => ({
        module: m,
        materials: (mats ?? []).filter((x) => x.module_id === m.id),
      }));
    },
  });

  async function open(path: string) {
    try {
      const res = await signUrl({ data: { path } });
      window.open(res.url, "_blank", "noopener");
    } catch (e: any) {
      toast.error(e?.message || "Could not open material");
    }
  }

  const totalMaterials = (data ?? []).reduce((n, g) => n + g.materials.length, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Study Materials</h1>
        <p className="text-muted-foreground">
          {totalMaterials} resource{totalMaterials === 1 ? "" : "s"} across all your modules.
        </p>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && totalMaterials === 0 && <p className="text-muted-foreground">No materials uploaded yet.</p>}

      <div className="space-y-6">
        {(data ?? [])
          .filter((g) => g.materials.length > 0)
          .map((g) => (
            <div key={g.module.id} className="space-y-3">
              <h2 className="text-lg font-semibold">
                {g.module.code} — {g.module.title}
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {g.materials.map((m) => (
                  <Card key={m.id} className="h-full">
                    <CardHeader>
                      <div className="mb-2 inline-flex w-fit rounded-md bg-accent p-2 text-accent-foreground">
                        <FileText className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-base">{m.title}</CardTitle>
                      <CardDescription className="line-clamp-2">{m.description || m.file_type || "Resource"}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full" onClick={() => open(m.file_path)}>
                        <Download className="mr-2 h-4 w-4" /> Open
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
