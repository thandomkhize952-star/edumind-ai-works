import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/enrollments")({
  component: AdminEnrollments,
});

function AdminEnrollments() {
  const qc = useQueryClient();
  const { data: enrollments } = useQuery({
    queryKey: ["all-enrollments"],
    queryFn: async () => {
      const { data: rows } = await supabase.from("enrollments").select("*, qualifications(code,title)").order("created_at", { ascending: false });
      const ids = Array.from(new Set((rows ?? []).map(r => r.student_id)));
      const profiles = ids.length ? (await supabase.from("profiles").select("id, full_name, email").in("id", ids)).data ?? [] : [];
      const byId = Object.fromEntries(profiles.map(p => [p.id, p]));
      return (rows ?? []).map(r => ({ ...r, student: byId[r.student_id] }));
    },
  });
  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data: r } = await supabase.from("user_roles").select("user_id").eq("role", "student");
      const ids = (r ?? []).map(x => x.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      return data ?? [];
    },
  });
  const { data: quals } = useQuery({ queryKey: ["qualifications"], queryFn: async () => (await supabase.from("qualifications").select("*")).data ?? [] });

  const [studentId, setStudentId] = useState(""); const [qualId, setQualId] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("enrollments").insert({ student_id: studentId, qualification_id: qualId });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["all-enrollments"] }); toast.success("Enrolled"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("enrollments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-enrollments"] }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">Enrollments</h1>
      <Card>
        <CardHeader><CardTitle>Enroll a student</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger className="w-[280px]"><SelectValue placeholder="Student" /></SelectTrigger>
            <SelectContent>{students?.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name || s.email}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={qualId} onValueChange={setQualId}>
            <SelectTrigger className="w-[280px]"><SelectValue placeholder="Qualification" /></SelectTrigger>
            <SelectContent>{quals?.map(q => <SelectItem key={q.id} value={q.id}>{q.code} — {q.title}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => { if (studentId && qualId) add.mutate(); }} disabled={add.isPending}>Enroll</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All enrollments</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Qualification</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {enrollments?.map(e => (
                <TableRow key={e.id}>
                  <TableCell>{e.student?.full_name || e.student?.email}</TableCell>
                  <TableCell>{e.qualifications?.code} — {e.qualifications?.title}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => del.mutate(e.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
