import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronRight, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/student/courses/$qualId")({
  component: QualModules,
});

function QualModules() {
  const { qualId } = useParams({ from: "/_authenticated/student/courses/$qualId" });
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
      return { qual: q, modules: mods ?? [] };
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/student/courses"><ArrowLeft className="mr-2 h-4 w-4" /> Back to courses</Link>
      </Button>
      <div>
        <h1 className="text-3xl font-bold">{data?.qual?.code} — {data?.qual?.title}</h1>
        {data?.qual?.description && <p className="text-muted-foreground">{data.qual.description}</p>}
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && data?.modules.length === 0 && (
        <p className="text-muted-foreground">No modules in this qualification yet.</p>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data?.modules.map((m) => (
          <Link
            key={m.id}
            to="/student/modules/$moduleId"
            params={{ moduleId: m.id }}
            className="block transition-transform hover:-translate-y-0.5"
          >
            <Card className="h-full hover:border-primary hover:shadow-md transition-all">
              <CardHeader>
                <div className="mb-2 inline-flex w-fit rounded-md bg-accent p-2 text-accent-foreground">
                  <BookOpen className="h-4 w-4" />
                </div>
                <CardTitle className="text-base">{m.code} — {m.title}</CardTitle>
                <CardDescription className="line-clamp-2">{m.description || "Open module"}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-end text-sm text-muted-foreground">
                <ChevronRight className="h-4 w-4" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
