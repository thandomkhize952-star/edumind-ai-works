import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listAllUsers, setUserRole, deleteUser, createStaffUser } from "@/lib/admin.functions";
import { getCurrentUserContext } from "@/lib/user.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsers,
});

const ROLES = ["admin", "lecturer", "student"] as const;

function AdminUsers() {
  const list = useServerFn(listAllUsers);
  const set = useServerFn(setUserRole);
  const del = useServerFn(deleteUser);
  const addStaff = useServerFn(createStaffUser);
  const me = useServerFn(getCurrentUserContext);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => list() });
  const { data: meData } = useQuery({ queryKey: ["me"], queryFn: () => me() });
  const m = useMutation({
    mutationFn: (v: { userId: string; role: "admin" | "lecturer" | "student"; enabled: boolean }) => set({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Role updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
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
  onCreate: (v: { email: string; password: string; fullName: string; role: "lecturer" | "admin" }) => Promise<unknown>;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const m = useMutation({
    mutationFn: () => onCreate({ ...form, role: "lecturer" }),
    onSuccess: () => {
      toast.success("Lecturer account created");
      setForm({ fullName: "", email: "", password: "" });
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add a lecturer</CardTitle>
        <CardDescription>Only admins can create lecturer accounts. The lecturer signs in with these details.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 sm:grid-cols-4 sm:items-end"
          onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
        >
          <div><Label htmlFor="lname">Full name</Label><Input id="lname" required value={form.fullName} onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))} /></div>
          <div><Label htmlFor="lemail">Email</Label><Input id="lemail" type="email" required value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div><Label htmlFor="lpw">Temporary password</Label><Input id="lpw" type="text" required minLength={6} value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} /></div>
          <Button type="submit" disabled={m.isPending}>{m.isPending ? "Creating…" : "Create lecturer"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
