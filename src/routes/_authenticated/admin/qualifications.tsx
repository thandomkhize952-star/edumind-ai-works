import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/qualifications")({
  component: AdminQualifications,
});

function AdminQualifications() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["qualifications"],
    queryFn: async () => (await supabase.from("qualifications").select("*").order("code")).data ?? [],
  });
  const [code, setCode] = useState(""); const [title, setTitle] = useState(""); const [desc, setDesc] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("qualifications").insert({ code, title, description: desc });
      if (error) throw error;
    },
    onSuccess: () => { setCode(""); setTitle(""); setDesc(""); qc.invalidateQueries({ queryKey: ["qualifications"] }); toast.success("Qualification added"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("qualifications").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["qualifications"] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">Qualifications</h1>

      <Card>
        <CardHeader><CardTitle>Add qualification</CardTitle><CardDescription>e.g. BCom, Diploma in IT</CardDescription></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[140px_1fr_2fr_auto] md:items-end" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
            <div><Label>Code</Label><Input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="BSC-CS" /></div>
            <div><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="BSc Computer Science" /></div>
            <div><Label>Description</Label><Textarea rows={1} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
            <Button type="submit" disabled={add.isPending}>Add</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All qualifications</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Title</TableHead><TableHead>Description</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {data?.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono">{q.code}</TableCell>
                  <TableCell className="font-medium">{q.title}</TableCell>
                  <TableCell className="text-muted-foreground">{q.description}</TableCell>
                  <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => del.mutate(q.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
