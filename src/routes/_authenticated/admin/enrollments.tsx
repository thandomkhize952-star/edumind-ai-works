import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { listEnrollments, reviewEnrollment, deleteEnrollment } from "@/lib/enrollments.functions";

export const Route = createFileRoute("/_authenticated/admin/enrollments")({
  component: AdminEnrollments,
});

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Approved</Badge>;
  if (status === "declined") return <Badge variant="destructive">Declined</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}

function AdminEnrollments() {
  const qc = useQueryClient();
  const fetchAll = useServerFn(listEnrollments);
  const review = useServerFn(reviewEnrollment);
  const remove = useServerFn(deleteEnrollment);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["all-enrollments"],
    queryFn: () => fetchAll(),
  });

  const decide = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "declined" }) => review({ data: v }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["all-enrollments"] });
      toast.success(v.decision === "approved" ? "Enrollment approved" : "Enrollment declined");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-enrollments"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = (rows ?? []).filter((r) => r.status === "pending");
  const reviewed = (rows ?? []).filter((r) => r.status !== "pending");

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">Enrollments</h1>

      <Card>
        <CardHeader>
          <CardTitle>Enrollment requests</CardTitle>
          <CardDescription>
            Students request a qualification when they sign up. Accept or decline each request here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">{isLoading ? "Loading…" : "No pending requests."}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Qualification</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.student_name || r.student_email}</div>
                      <div className="text-xs text-muted-foreground">{r.student_number || r.student_email}</div>
                    </TableCell>
                    <TableCell>{r.qualification_code} — {r.qualification_title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button
                        size="sm"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ id: r.id, decision: "approved" })}
                      >
                        <Check className="mr-1 h-4 w-4" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ id: r.id, decision: "declined" })}
                      >
                        <X className="mr-1 h-4 w-4" /> Decline
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All enrollments</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Qualification</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviewed.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.student_name || r.student_email}</TableCell>
                  <TableCell>{r.qualification_code} — {r.qualification_title}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => del.mutate(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
