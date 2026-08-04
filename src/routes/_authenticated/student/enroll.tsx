import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { requestEnrollment } from "@/lib/enrollments.functions";

export const Route = createFileRoute("/_authenticated/student/enroll")({
  component: Enroll,
});

function Enroll() {
  const qc = useQueryClient();
  const request = useServerFn(requestEnrollment);

  const { data: quals } = useQuery({
    queryKey: ["enroll-quals"],
    queryFn: async () => (await supabase.from("qualifications").select("*").order("code")).data ?? [],
  });
  const { data: mine } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      return (await supabase.from("enrollments").select("qualification_id, status").eq("student_id", u.user.id)).data ?? [];
    },
  });

  const statusFor = new Map((mine ?? []).map(m => [m.qualification_id, m.status]));
  const locked = (mine ?? []).some(m => m.status === "pending" || m.status === "approved");
  const hasPending = (mine ?? []).some(m => m.status === "pending");

  const enroll = useMutation({
    mutationFn: (qid: string) => request({ data: { qualificationId: qid } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
      qc.invalidateQueries({ queryKey: ["my-courses"] });
      toast.success("Request sent — an admin will review your enrollment.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Browse Qualifications</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {hasPending
            ? "Your enrollment request is awaiting admin approval. You'll be notified once it's reviewed."
            : locked
              ? "You're already enrolled in a qualification. Contact an admin if you need to switch."
              : "Choose a qualification to request enrollment. An admin will accept or decline your request."}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {quals?.map(q => {
          const st = statusFor.get(q.id);
          return (
            <Card key={q.id}>
              <CardHeader>
                <CardTitle className="text-base">{q.code}</CardTitle>
                <CardDescription>{q.title}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{q.description || "—"}</p>
                {st === "approved" ? (
                  <Button disabled variant="outline" className="w-full">Enrolled</Button>
                ) : st === "pending" ? (
                  <Button disabled variant="outline" className="w-full">Awaiting approval</Button>
                ) : (
                  <Button
                    className="w-full"
                    disabled={locked || enroll.isPending}
                    onClick={() => enroll.mutate(q.id)}
                  >
                    {st === "declined" ? "Request declined" : locked ? "Enrollment locked" : "Request enrollment"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
