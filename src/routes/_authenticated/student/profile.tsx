import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { ensureStudentNumber } from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_authenticated/student/profile")({
  component: Profile,
});

function Profile() {
  const qc = useQueryClient();
  const allocate = useServerFn(ensureStudentNumber);
  useQuery({ queryKey: ["ensure-student-number"], queryFn: async () => { const r = await allocate({ data: {} as never }); if (r?.studentNumber) qc.invalidateQueries({ queryKey: ["my-profile"] }); return r; }, staleTime: Infinity });
  const { data } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return p;
    },
  });
  const [form, setForm] = useState({ full_name: "", student_number: "", phone: "", bio: "" });
  useEffect(() => { if (data) setForm({ full_name: data.full_name ?? "", student_number: data.student_number ?? "", phone: data.phone ?? "", bio: data.bio ?? "" }); }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!data) return;
      const { student_number: _sn, ...editable } = form;
      const { error } = await supabase.from("profiles").update(editable).eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["my-profile"] }); qc.invalidateQueries({ queryKey: ["me"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">My Profile</h1>
      <Card>
        <CardHeader><CardTitle>Personal information</CardTitle><CardDescription>{data?.email}</CardDescription></CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
            <div><Label>Student number</Label><Input value={form.student_number || "Being allocated…"} readOnly disabled /><p className="mt-1 text-xs text-muted-foreground">Automatically allocated by the system.</p></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label>Bio</Label><Textarea rows={4} value={form.bio} onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))} /></div>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
