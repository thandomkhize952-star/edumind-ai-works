import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getModuleLecturers } from "@/lib/modules.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/PageHero";
import { LayoutGrid, ArrowRight, ArrowLeft, User, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/student/courses/$qualId")({
  component: QualModules,
});

function QualModules() {
  const { qualId } = useParams({ from: "/_authenticated/student/courses/$qualId" });
  const fetchLecturers = useServerFn(getModuleLecturers);
  const { data, isLoading } = useQuery({
    queryKey: ["qual-modules", qualId],
    queryFn: async () => {
      const { data: q } = await supabase
        .from("qualifications")
        .select("id, code, title, description")
        .eq("id", qualId)
        .maybeSingle();
      const { data: mods } = await supabase
        .from("modules")
        .select("id, code, title, description")
        .eq("qualification_id", qualId)
        .order("code");
      const modules = mods ?? [];
      let lecturers: Record<string, { full_name: string | null; email: string | null } | null> = {};
      if (modules.length) {
        try {
          lecturers = await fetchLecturers({ data: { moduleIds: modules.map((m) => m.id) } });
        } catch {
          lecturers = {};
        }
      }
      return { qual: q, modules, lecturers };
    },
  });

  const modules = data?.modules ?? [];
  const assigned = modules.filter((m) => data?.lecturers?.[m.id]).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/student/courses"><ArrowLeft className="mr-2 h-4 w-4" /> Back to courses</Link>
      </Button>

      <PageHero
        icon={LayoutGrid}
        title="My Modules"
        subtitle={
          data?.qual
            ? `${modules.length} module${modules.length === 1 ? "" : "s"} in ${data.qual.code} — ${data.qual.title}`
            : "Loading your modules…"
        }
        stats={[
          { label: "Total modules", value: modules.length },
          { label: "With a lecturer", value: assigned, tone: "accent" },
          { label: "Awaiting lecturer", value: modules.length - assigned, tone: "warning" },
          { label: "Course", value: data?.qual?.code ?? "—", tone: "primary" },
        ]}
      />

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && modules.length === 0 && (
        <p className="text-muted-foreground">No modules in this qualification yet.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((m, i) => {
          const lec = data?.lecturers?.[m.id];
          return (
            <Link
              key={m.id}
              to="/student/modules/$moduleId"
              params={{ moduleId: m.id }}
              className="group block"
            >
              <Card className="glass h-full overflow-hidden border-border/60 transition-all duration-200 group-hover:-translate-y-1 group-hover:border-primary/50 group-hover:shadow-xl group-hover:shadow-primary/10">
                <CardContent className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-md shadow-primary/25">
                        <BookOpen className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold">{m.title}</h3>
                        <p className="truncate text-xs text-muted-foreground">{m.code}</p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                      #{i + 1}
                    </span>
                  </div>

                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {m.description || "Open the module to see materials, quizzes and assignments."}
                  </p>

                  <div className="mt-auto space-y-3">
                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-secondary/60 px-2.5 py-1 text-xs text-muted-foreground">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{lec?.full_name || lec?.email || "Lecturer unassigned"}</span>
                    </span>
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/10 py-2.5 text-sm font-medium text-primary transition-colors group-hover:bg-primary/20">
                      Open module
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
