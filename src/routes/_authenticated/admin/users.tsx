import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listAllUsers, deleteUser, createStaffUser } from "@/lib/admin.functions";
import { getCurrentUserContext } from "@/lib/user.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { joinName } from "@/lib/name";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsers,
});

const ROLES = ["admin", "lecturer", "career_advisor", "student"] as const;

function AdminUsers() {
  const list = useServerFn(listAllUsers);
  const del = useServerFn(deleteUser);
  const addStaff = useServerFn(createStaffUser);
  const me = useServerFn(getCurrentUserContext);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => list() });
  const { data: meData } = useQuery({ queryKey: ["me"], queryFn: () => me() });
  const delM = useMutation({
    mutationFn: (userId: string) => del({ data: { userId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("User deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-muted-foreground">Students self-register and are auto-assigned a student number. Lecturers are added here by an admin.</p>
      </div>
      <AddLecturerCard onCreate={(v) => addStaff({ data: v })} onCreated={() => qc.invalidateQueries({ queryKey: ["admin-users"] })} />
      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
          <CardDescription>{data?.length ?? 0} accounts</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((u) => {
                  const isSelf = meData?.userId === u.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {(u.roles.length ? ROLES.filter(r => u.roles.includes(r)) : ["student"]).map((r) => (
                            <Badge key={r} variant={r === "admin" ? "default" : r === "lecturer" ? "secondary" : "outline"} className="capitalize">
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={isSelf || delM.isPending}
                              title={isSelf ? "You cannot delete your own account" : "Delete user"}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this user?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This permanently removes <strong>{u.email}</strong> and all of their data (enrollments, submissions, materials they uploaded, etc.). This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => delM.mutate(u.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AddLecturerCard({
  onCreate,
  onCreated,
}: {
  onCreate: (v: { email: string; password: string; fullName: string; role: "lecturer" | "admin" | "career_advisor" }) => Promise<unknown>;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [role, setRole] = useState<"lecturer" | "career_advisor">("lecturer");
  const m = useMutation({
    mutationFn: () => onCreate({
      email: form.email,
      password: form.password,
      fullName: joinName(form.firstName, form.lastName),
      role,
    }),
    onSuccess: () => {
      toast.success(role === "lecturer" ? "Lecturer account created" : "Career advisor account created");
      setForm({ firstName: "", lastName: "", email: "", password: "" });
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add staff</CardTitle>
        <CardDescription>Only admins can create lecturer and career advisor accounts. They sign in with these details.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 sm:grid-cols-6 sm:items-end"
          onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
        >
          <div><Label htmlFor="lfname">First name</Label><Input id="lfname" required value={form.firstName} onChange={(e) => setForm(f => ({ ...f, firstName: e.target.value }))} /></div>
          <div><Label htmlFor="llname">Last name</Label><Input id="llname" required value={form.lastName} onChange={(e) => setForm(f => ({ ...f, lastName: e.target.value }))} /></div>
          <div><Label htmlFor="lemail">Email</Label><Input id="lemail" type="email" required value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div><Label htmlFor="lpw">Temporary password</Label><Input id="lpw" type="text" required minLength={6} value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} /></div>
          <div>
            <Label htmlFor="lrole">Role</Label>
            <select
              id="lrole"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as "lecturer" | "career_advisor")}
            >
              <option value="lecturer">Lecturer</option>
              <option value="career_advisor">Career advisor</option>
            </select>
          </div>
          <Button type="submit" disabled={m.isPending}>{m.isPending ? "Creating…" : "Create account"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

