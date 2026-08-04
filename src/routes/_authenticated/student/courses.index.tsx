import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GraduationCap, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/student/courses/")({
  component: MyCourses,
});

function MyCourses() {
  const { data, isLoading } = useQuery({
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
      // module counts
      const ids = quals.map((q) => q.id);
      let counts: Record<string, number> = {};
      if (ids.length) {
        const { data: mods } = await supabase.from("modules").select("qualification_id").in("qualification_id", ids);
        for (const m of mods ?? []) counts[m.qualification_id] = (counts[m.qualification_id] ?? 0) + 1;
      }
      return quals.map((q) => ({ ...q, moduleCount: counts[q.id] ?? 0 }));
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">My Courses</h1>
        <p className="text-muted-foreground">Select a course to view its modules.</p>
      </div>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && data?.length === 0 && (
        <p className="text-muted-foreground">
          You're not enrolled in any qualifications yet.{" "}
          <Link className="text-primary underline" to="/student/enroll">Browse qualifications</Link>.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((q) => (
          <Link
            key={q.id}
            to="/student/courses/$qualId"
            params={{ qualId: q.id }}
            className="block transition-transform hover:-translate-y-0.5"
          >
            <Card className="h-full hover:border-primary hover:shadow-md transition-all">
              <CardHeader>
                <div className="mb-2 inline-flex w-fit rounded-md bg-accent p-2 text-accent-foreground">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <CardTitle className="text-base">{q.code} — {q.title}</CardTitle>
                <CardDescription>{q.moduleCount} module{q.moduleCount === 1 ? "" : "s"}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                <span className="line-clamp-2">{q.description || "Open to view modules."}</span>
                <ChevronRight className="h-4 w-4 shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
