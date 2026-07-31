import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { UserCog } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lecturer/profile")({
  component: LecturerProfile,
});

function LecturerProfile() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return p;
    },
  });

  const [form, setForm] = useState({ full_name: "", phone: "", bio: "", email: "" });
  const [initialEmail, setInitialEmail] = useState("");

  useEffect(() => {
    if (data) {
      setForm({
        full_name: data.full_name ?? "",
        phone: data.phone ?? "",
        bio: data.bio ?? "",
        email: data.email ?? "",
      });
      setInitialEmail(data.email ?? "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!data) return;
      const trimmedEmail = form.email.trim();
      const emailChanged = trimmedEmail && trimmedEmail !== initialEmail;

      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name,
          phone: form.phone,
          bio: form.bio,
          ...(emailChanged ? { email: trimmedEmail } : {}),
        })
        .eq("id", data.id);
      if (profErr) throw profErr;

      if (emailChanged) {
        const { error: authErr } = await supabase.auth.updateUser({ email: trimmedEmail });
        if (authErr) throw authErr;
        return { emailChanged: true };
      }
      return { emailChanged: false };
    },
    onSuccess: (res) => {
      toast.success(
        res?.emailChanged
          ? "Profile saved. Check your new email for a confirmation link."
          : "Profile saved",
      );
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/15 p-2 text-primary">
          <UserCog className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">My Profile</h1>
          <p className="text-muted-foreground">Update your personal information and contact details.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>Changes to your email require confirmation from the new address.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div>
              <Label>Full name</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Email address</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              {form.email !== initialEmail && (
                <p className="mt-1 text-xs text-muted-foreground">
                  You'll receive a confirmation link at the new address before the change takes effect.
                </p>
              )}
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label>Bio</Label>
              <Textarea
                rows={4}
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
