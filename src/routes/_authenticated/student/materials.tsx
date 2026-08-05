import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMaterialUrl } from "@/lib/storage.functions";
import { Card, CardContent } from "@/components/ui/card";
import { PageHero } from "@/components/PageHero";
import { Download, FileText, Library, Layers } from "lucide-react";
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
      const { data: enr } = await supabase.from("enrollments").select("qualification_id").eq("student_id", u.user.id).eq("status", "approved");
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

  const groups = (data ?? []).filter((g) => g.materials.length > 0);
  const totalMaterials = (data ?? []).reduce((n, g) => n + g.materials.length, 0);
  const latest = (data ?? [])
    .flatMap((g) => g.materials)
    .reduce<string | null>((acc, m) => (!acc || m.created_at > acc ? m.created_at : acc), null);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHero
        icon={Library}
        title="My Materials"
        subtitle={`${totalMaterials} resource${totalMaterials === 1 ? "" : "s"} from your enrolled modules`}
        gradient="from-accent to-primary"
        stats={[
          { label: "Total resources", value: totalMaterials, tone: "accent" },
          { label: "Modules covered", value: groups.length, tone: "primary" },
          { label: "All modules", value: (data ?? []).length },
          { label: "Last upload", value: latest ? new Date(latest).toLocaleDateString() : "—" },
        ]}
      />

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && totalMaterials === 0 && <p className="text-muted-foreground">No materials uploaded yet.</p>}

      <div className="space-y-8">
        {groups.map((g) => (
          <div key={g.module.id} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/70">
                <Layers className="h-4 w-4 text-accent" />
              </div>
              <h2 className="text-lg font-semibold">
                {g.module.code} <span className="text-muted-foreground">— {g.module.title}</span>
              </h2>
              <span className="ml-auto rounded-full border border-border/60 px-2.5 py-0.5 text-xs text-muted-foreground">
                {g.materials.length} item{g.materials.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {g.materials.map((m) => (
                <Card
                  key={m.id}
                  className="glass group h-full overflow-hidden border-border/60 transition-all duration-200 hover:-translate-y-1 hover:border-accent/50 hover:shadow-xl hover:shadow-accent/10"
                >
                  <CardContent className="flex h-full flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-primary shadow-md shadow-accent/20">
                          <FileText className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold">{m.title}</h3>
                          <p className="truncate text-xs text-muted-foreground">{g.module.title}</p>
                        </div>
                      </div>
                      {m.file_type && (
                        <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[11px] uppercase text-muted-foreground">
                          {m.file_type.split("/").pop()?.slice(0, 6)}
                        </span>
                      )}
                    </div>

                    <p className="line-clamp-2 text-sm text-muted-foreground">{m.description || "Course material"}</p>

                    <button
                      type="button"
                      onClick={() => open(m.file_path)}
                      className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-accent/25 bg-accent/10 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
                    >
                      <Download className="h-4 w-4" /> Download
                    </button>
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
