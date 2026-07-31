import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/lecturer/modules/")({
  component: LecturerModules,
});

function LecturerModules() {
  const { data } = useQuery({
    queryKey: ["lecturer-modules"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      return (await supabase.from("modules").select("*, qualifications(code,title)").eq("lecturer_id", u.user.id).order("code")).data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">My Modules</h1>
      <p className="text-muted-foreground">Modules assigned to you by an administrator.</p>

      {data?.length === 0 && (
        <p className="text-muted-foreground">No modules assigned yet. Please contact an administrator.</p>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data?.map(m => (
          <Card key={m.id}>
            <CardHeader>
              <div className="mb-2 inline-flex w-fit rounded-md bg-accent p-2"><BookOpen className="h-4 w-4" /></div>
              <CardTitle className="text-base">{m.code} — {m.title}</CardTitle>
              <CardDescription>{m.qualifications?.code} · {m.qualifications?.title}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full" variant="outline">
                <Link to="/lecturer/modules/$id" params={{ id: m.id }}>Open <ChevronRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
