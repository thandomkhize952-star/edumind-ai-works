import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAtRiskStudents, notifyAtRiskStudent, type AtRiskStudent } from "@/lib/at-risk.functions";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Send, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lecturer/at-risk")({
  component: AtRiskPage,
});

function AtRiskPage() {
  const fetchList = useServerFn(getAtRiskStudents);
  const { data, isLoading } = useQuery({
    queryKey: ["at-risk-students"],
    queryFn: () => fetchList(),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-destructive/15 p-2 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">At-Risk Students</h1>
          <p className="text-muted-foreground">
            Students in modules you teach whose average mark is below 50% — flagged on marks alone, even with perfect attendance.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flagged students</CardTitle>
          <CardDescription>
            {isLoading ? "Scanning…" : `${data?.length ?? 0} at-risk record${(data?.length ?? 0) === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <Skeleton className="h-40 w-full" />}
          {!isLoading && !data?.length && (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              🎉 No students are currently at risk in your modules.
            </div>
          )}
          {!isLoading && !!data?.length && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Avg Mark</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>Last notified</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <AtRiskRow key={`${row.student_id}:${row.module_id}`} row={row} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AtRiskRow({ row }: { row: AtRiskStudent }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const qc = useQueryClient();
  const notify = useServerFn(notifyAtRiskStudent);

  const send = useMutation({
    mutationFn: () =>
      notify({
        data: {
          studentId: row.student_id,
          moduleId: row.module_id,
          message: message.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success(`Notification sent to ${row.full_name || row.email}`);
      setOpen(false);
      setMessage("");
      qc.invalidateQueries({ queryKey: ["at-risk-students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const notifiedRecently =
    row.last_notified_at && Date.now() - new Date(row.last_notified_at).getTime() < 7 * 24 * 60 * 60 * 1000;

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{row.full_name || "—"}</div>
        <div className="text-xs text-muted-foreground">
          {row.student_number ? `${row.student_number} · ` : ""}
          {row.email}
        </div>
      </TableCell>
      <TableCell>
        <div className="font-medium">{row.module_code}</div>
        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{row.module_title}</div>
      </TableCell>
      <TableCell className="min-w-[140px]">
        <div className="flex items-center gap-2">
          <Badge variant="destructive">{row.avg_mark_pct}%</Badge>
          <span className="text-xs text-muted-foreground">{row.graded_count} graded</span>
        </div>
        <Progress value={row.avg_mark_pct ?? 0} className="mt-1 h-1.5" />
      </TableCell>
      <TableCell className="min-w-[140px]">
        <div className="flex items-center gap-2">
          <Badge variant="destructive">{row.attendance_pct}%</Badge>
          <span className="text-xs text-muted-foreground">{row.attendance_count} classes</span>
        </div>
        <Progress value={row.attendance_pct ?? 0} className="mt-1 h-1.5" />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {row.last_notified_at ? (
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            {new Date(row.last_notified_at).toLocaleDateString()}
          </span>
        ) : (
          "Never"
        )}
      </TableCell>
      <TableCell className="text-right">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant={notifiedRecently ? "outline" : "default"}>
              <Send className="mr-1 h-3 w-3" />
              Reach out
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reach out to {row.full_name || row.email}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                A notification will appear in the student's account for <b>{row.module_code}</b>. Leave the message blank to send the default at-risk warning.
              </p>
              <Textarea
                rows={5}
                placeholder="Optional custom message…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              {notifiedRecently && (
                <p className="text-xs text-amber-600">
                  You already notified this student in the last 7 days.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => send.mutate()} disabled={send.isPending}>
                {send.isPending ? "Sending…" : "Send notification"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}
