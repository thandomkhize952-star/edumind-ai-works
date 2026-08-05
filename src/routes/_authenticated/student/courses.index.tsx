import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
import { GraduationCap, ArrowRight, LayoutGrid, Users, Layers, Star } from "lucide-react";

export const Route = createFileRoute("/_authenticated/student/courses/")({
  component: MyCourses,
  head: () => ({
    meta: [
      { title: "Diploma Programs | EduMind AI" },
      { name: "description", content: "Explore your enrolled diploma programs, modules and study resources on EduMind AI." },
      { property: "og:title", content: "Diploma Programs | EduMind AI" },
      { property: "og:description", content: "Explore your enrolled diploma programs and modules on EduMind AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Qual = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  moduleTitles: string[];
  moduleCount: number;
  studentCount: number;
};

function MyCourses() {
  const { data, isLoading } = useQuery<Qual[]>({
    queryKey: ["my-qualifications"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data: enr } = await supabase
        .from("enrollments")
        .select("qualification_id, qualifications(id, code, title, description)")
        .eq("student_id", u.user.id)
        .eq("status", "approved");
      const quals = (enr ?? []).map((e) => e.qualifications).filter(Boolean) as Array<{
        id: string; code: string; title: string; description: string | null;
      }>;
      const ids = quals.map((q) => q.id);
      const modsByQual: Record<string, string[]> = {};
      const studentsByQual: Record<string, number> = {};
      if (ids.length) {
        const { data: mods } = await supabase
          .from("modules")
          .select("qualification_id, title")
          .in("qualification_id", ids);
        for (const m of mods ?? []) {
          (modsByQual[m.qualification_id] ??= []).push(m.title);
        }
        const { data: peers } = await supabase
          .from("enrollments")
          .select("qualification_id")
          .in("qualification_id", ids)
          .eq("status", "approved");
        for (const p of peers ?? []) {
          studentsByQual[p.qualification_id] = (studentsByQual[p.qualification_id] ?? 0) + 1;
        }
      }
      return quals.map((q) => ({
        ...q,
        moduleTitles: modsByQual[q.id] ?? [],
        moduleCount: (modsByQual[q.id] ?? []).length,
        studentCount: studentsByQual[q.id] ?? 1,
      }));
    },
  });

  const totalModules = (data ?? []).reduce((a, q) => a + q.moduleCount, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageHero
        icon={GraduationCap}
        title="Diploma Programs"
        subtitle="Explore and enroll in diploma programs"
        stats={
          data && data.length
            ? [
                { label: "Programs", value: data.length, tone: "primary" },
                { label: "Modules", value: totalModules, tone: "accent" },
              ]
            : undefined
        }
      />

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      {!isLoading && data?.length === 0 && (
        <p className="text-muted-foreground">
          You're not enrolled in any qualifications yet.{" "}
          <Link className="text-primary underline" to="/student/enroll">Browse qualifications</Link>.
        </p>
      )}

      <div className="space-y-6">
        {data?.map((q) => (
          <article key={q.id} className="glass overflow-hidden rounded-2xl">
            {/* Banner */}
            <div className="relative h-40 overflow-hidden bg-gradient-to-r from-primary via-primary/80 to-accent">
              <div
                aria-hidden
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    "radial-gradient(currentColor 1px, transparent 1px)",
                  backgroundSize: "18px 18px",
                }}
              />
              <div className="relative flex items-center gap-2 p-4">
                <span className="rounded-full bg-background/25 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-foreground backdrop-blur">
                  {q.code}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-background/25 px-3 py-1 text-xs font-semibold text-primary-foreground backdrop-blur">
                  <Star className="h-3.5 w-3.5 text-warning" />
                  {q.moduleCount} module{q.moduleCount === 1 ? "" : "s"}
                </span>
              </div>
              <div
                aria-hidden
                className="absolute bottom-4 right-8 h-16 w-16 rounded-2xl bg-background/20 backdrop-blur"
              />
            </div>

            {/* Body */}
            <div className="space-y-4 p-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight">{q.title}</h2>
                {q.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{q.description}</p>
                )}
              </div>

              {q.moduleTitles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Modules ({q.moduleCount})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {q.moduleTitles.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="max-w-[14rem] truncate rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-foreground"
                      >
                        {t}
                      </span>
                    ))}
                    {q.moduleTitles.length > 3 && (
                      <span className="rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-primary">
                        +{q.moduleTitles.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-5 border-t border-border/60 pt-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent">
                    <Users className="h-3.5 w-3.5 text-primary-foreground" />
                  </span>
                  <span className="font-semibold text-foreground">{q.studentCount}</span> students
                </span>
                <span className="inline-flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  <span className="font-semibold text-foreground">{q.moduleCount}</span> modules
                </span>
              </div>

              <Link
                to="/student/courses/$qualId"
                params={{ qualId: q.id }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm font-semibold transition-colors hover:border-primary/60 hover:bg-primary/10"
              >
                View Program Details
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
