import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/modules")({
  component: AdminModules,
});

const UNASSIGNED = "__unassigned__";

function AdminModules() {
  const qc = useQueryClient();
  const { data: quals } = useQuery({ queryKey: ["qualifications"], queryFn: async () => (await supabase.from("qualifications").select("*").order("code")).data ?? [] });
  const { data: lecturers } = useQuery({
    queryKey: ["lecturers"],
    queryFn: async () => {
      const { data: r } = await supabase.from("user_roles").select("user_id").eq("role", "lecturer");
      const ids = (r ?? []).map(x => x.user_id);
      if (ids.length === 0) return [];
      const { data: p } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      return p ?? [];
    },
  });
  const { data: modules } = useQuery({
    queryKey: ["modules"],
    queryFn: async () => {
      const { data: rows } = await supabase.from("modules").select("*, qualifications(code,title)").order("code");
      const ids = Array.from(new Set((rows ?? []).map(r => r.lecturer_id).filter(Boolean) as string[]));
      const lp = ids.length ? (await supabase.from("profiles").select("id, full_name, email").in("id", ids)).data ?? [] : [];
      const byId = Object.fromEntries(lp.map(p => [p.id, p]));
      return (rows ?? []).map(r => ({ ...r, lecturer: r.lecturer_id ? byId[r.lecturer_id] : null }));
    },
  });

  const [code, setCode] = useState(""); const [title, setTitle] = useState("");
  const [qualId, setQualId] = useState<string>(""); const [lectId, setLectId] = useState<string>(UNASSIGNED);

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("modules").insert({ code, title, qualification_id: qualId, lecturer_id: lectId === UNASSIGNED ? null : lectId });
      if (error) throw error;
    },
    onSuccess: () => { setCode(""); setTitle(""); setLectId(UNASSIGNED); qc.invalidateQueries({ queryKey: ["modules"] }); toast.success("Module created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const assign = useMutation({
    mutationFn: async (v: { moduleId: string; lecturerId: string | null }) => {
      const { error } = await supabase.from("modules").update({ lecturer_id: v.lecturerId }).eq("id", v.moduleId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["modules"] }); toast.success("Updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("modules").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modules"] }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">Modules</h1>
      <Card>
        <CardHeader><CardTitle>Add module</CardTitle><CardDescription>Assign to a qualification and optionally a lecturer.</CardDescription></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-5 md:items-end" onSubmit={(e) => { e.preventDefault(); if (!qualId) { toast.error("Pick a qualification"); return; } add.mutate(); }}>
            <div><Label>Code</Label><Input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="CS101" /></div>
            <div><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Intro to CS" /></div>
            <div>
              <Label>Qualification</Label>
              <Select value={qualId} onValueChange={setQualId}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>{quals?.map(q => <SelectItem key={q.id} value={q.id}>{q.code} — {q.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lecturer</Label>
              <Select value={lectId} onValueChange={setLectId}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {lecturers?.map(l => <SelectItem key={l.id} value={l.id}>{l.full_name || l.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={add.isPending}>Add</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All modules</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Title</TableHead><TableHead>Qualification</TableHead><TableHead>Lecturer</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {modules?.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono">{m.code}</TableCell>
                  <TableCell className="font-medium">{m.title}</TableCell>
                  <TableCell>{m.qualifications?.code}</TableCell>
                  <TableCell>
                    <Select value={m.lecturer_id ?? UNASSIGNED} onValueChange={(v) => assign.mutate({ moduleId: m.id, lecturerId: v === UNASSIGNED ? null : v })}>
                      <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                        {lecturers?.map(l => <SelectItem key={l.id} value={l.id}>{l.full_name || l.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => del.mutate(m.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
