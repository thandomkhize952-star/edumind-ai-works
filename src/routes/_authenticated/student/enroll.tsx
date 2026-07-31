import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student/enroll")({
  component: Enroll,
});

function Enroll() {
  const qc = useQueryClient();
  const { data: quals } = useQuery({
    queryKey: ["enroll-quals"],
    queryFn: async () => (await supabase.from("qualifications").select("*").order("code")).data ?? [],
  });
  const { data: mine } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      return (await supabase.from("enrollments").select("qualification_id").eq("student_id", u.user.id)).data ?? [];
    },
  });

  const enrolled = new Set((mine ?? []).map(m => m.qualification_id));
  const hasEnrollment = (mine?.length ?? 0) > 0;
  const enroll = useMutation({
    mutationFn: async (qid: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("enrollments").insert({ student_id: u.user.id, qualification_id: qid });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-enrollments"] }); qc.invalidateQueries({ queryKey: ["my-courses"] }); toast.success("Enrolled"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Browse Qualifications</h1>
        {hasEnrollment && (
          <p className="mt-2 text-sm text-muted-foreground">
            You're already enrolled in a qualification. Students can only be enrolled in one qualification at a time — contact an admin if you need to switch.
          </p>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {quals?.map(q => (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="text-base">{q.code}</CardTitle>
              <CardDescription>{q.title}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{q.description || "—"}</p>
              {enrolled.has(q.id) ? (
                <Button disabled variant="outline" className="w-full">Enrolled</Button>
              ) : (
                <Button
                  className="w-full"
                  disabled={hasEnrollment || enroll.isPending}
                  onClick={() => enroll.mutate(q.id)}
                >
                  {hasEnrollment ? "Enrollment locked" : "Enroll"}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
