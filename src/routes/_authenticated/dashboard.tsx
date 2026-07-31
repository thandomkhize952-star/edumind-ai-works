import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUserContext } from "@/lib/user.functions";
import { listAllUsers } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Award, Brain, CalendarCheck, ClipboardList, BookOpen, GraduationCap, Users, Layers, FileText, ArrowRight, FolderOpen, Plus, Zap, UserPlus, BarChart3, IdCard, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const fetchCtx = useServerFn(getCurrentUserContext);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => fetchCtx() });
  const roles = me?.roles ?? [];
  const isLecturer = roles.includes("lecturer");
  const isAdmin = roles.includes("admin");
  const isStudent = !isLecturer && !isAdmin && (roles.includes("student") || roles.length === 0);
  const name = me?.profile?.full_name || me?.profile?.email || "there";

  if (isLecturer && me?.userId) {
    return <LecturerDashboard userId={me.userId} name={name} />;
  }

  if (isAdmin) {
    return <AdminDashboard name={name} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {name}</h1>
        <p className="text-muted-foreground">
          Role{roles.length > 1 ? "s" : ""}: {roles.join(", ") || "student"}
        </p>
      </div>

      {isStudent && me?.userId && <StudentDashboard userId={me.userId} />}
    </div>
  );
}

function AdminDashboard({ name }: { name: string }) {
  const fetchUsers = useServerFn(listAllUsers);
  const { data: users, isLoading } = useQuery({ queryKey: ["admin-all-users"], queryFn: () => fetchUsers() });

  const { data: courseCount } = useQuery({
    queryKey: ["admin-course-count"],
    queryFn: async () => {
      const { count } = await supabase.from("qualifications").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const list = users ?? [];
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const usersLast7 = list.filter((u) => u.created_at && +new Date(u.created_at) >= weekAgo).length;
  const students = list.filter((u) => u.roles.includes("student")).length;
  const lecturers = list.filter((u) => u.roles.includes("lecturer")).length;
  const recent = [...list]
    .sort((a, b) => +new Date(b.created_at ?? 0) - +new Date(a.created_at ?? 0))
    .slice(0, 6);

  const initials = (n?: string | null, e?: string | null) => {
    const s = (n || e || "?").trim();
    const parts = s.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
  };

  const primaryRole = (roles: string[]) =>
    roles.includes("admin") ? "admin" : roles.includes("lecturer") ? "lecturer" : "student";

  const roleTone: Record<string, string> = {
    admin: "bg-primary/15 text-primary border-primary/30",
    lecturer: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    student: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {name}</h1>
        <p className="text-muted-foreground">Platform overview at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStat icon={Users} tint="sky" label="Total Users" corner="Last 7 days" value={list.length} sub={`+${usersLast7} new this week`} />
        <AdminStat icon={UserRound} tint="emerald" label="Students" corner="Total" value={students} />
        <AdminStat icon={IdCard} tint="amber" label="Lecturers" corner="Total" value={lecturers} />
        <AdminStat icon={BookOpen} tint="fuchsia" label="Active Courses" corner="Active" value={courseCount ?? 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/15 p-2 text-primary"><Zap className="h-5 w-5" /></div>
              <CardTitle>Quick Actions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <AdminAction to="/admin/users" icon={Users} tint="sky" title="Manage Users" sub="View and edit user accounts" />
            <AdminAction to="/admin/qualifications" icon={BookOpen} tint="emerald" title="Manage Courses" sub="Create and organize courses" />
            <AdminAction to="/admin/enrollments" icon={UserPlus} tint="amber" title="Manage Enrollments" sub="Handle student enrollments" />
            <AdminAction to="/admin/analytics" icon={BarChart3} tint="fuchsia" title="Analytics" sub="View platform insights" />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/15 p-2 text-primary"><UserPlus className="h-5 w-5" /></div>
                <CardTitle>Recent Registrations</CardTitle>
              </div>
              <Link to="/admin/users" className="flex items-center gap-1 text-sm text-primary hover:underline">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-2 text-xs uppercase tracking-wide text-muted-foreground pb-2 border-b">
              <div>User</div><div>Role</div><div>Joined</div><div className="text-right">Status</div>
            </div>
            {isLoading && <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>}
            {!isLoading && !recent.length && (
              <div className="py-6 text-center text-sm text-muted-foreground">No registrations yet.</div>
            )}
            <div className="divide-y">
              {recent.map((u) => {
                const role = primaryRole(u.roles);
                return (
                  <div key={u.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold shrink-0">
                        {initials(u.full_name, u.email)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{u.full_name || "—"}</div>
                        <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                    <Badge variant="outline" className={`capitalize ${roleTone[role]}`}>{role}</Badge>
                    <div className="text-sm text-muted-foreground whitespace-nowrap">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }) : "—"}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 text-xs text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Active
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminStat({
  icon: Icon, label, value, sub, corner, tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number | string; sub?: string; corner?: string;
  tint: "sky" | "emerald" | "amber" | "fuchsia";
}) {
  const tints: Record<string, string> = {
    sky: "bg-sky-500/15 text-sky-300",
    emerald: "bg-emerald-500/15 text-emerald-300",
    amber: "bg-amber-500/15 text-amber-300",
    fuchsia: "bg-fuchsia-500/15 text-fuchsia-300",
  };
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className={`rounded-lg p-2.5 ${tints[tint]}`}><Icon className="h-5 w-5" /></div>
          {corner && <span className="text-xs text-muted-foreground">{corner}</span>}
        </div>
        <div className="mt-4 text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 text-4xl font-bold tracking-tight">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function AdminAction({
  to, icon: Icon, title, sub, tint,
}: {
  to: string; icon: React.ComponentType<{ className?: string }>; title: string; sub: string;
  tint: "sky" | "emerald" | "amber" | "fuchsia";
}) {
  const tints: Record<string, string> = {
    sky: "bg-sky-500/15 text-sky-300",
    emerald: "bg-emerald-500/15 text-emerald-300",
    amber: "bg-amber-500/15 text-amber-300",
    fuchsia: "bg-fuchsia-500/15 text-fuchsia-300",
  };
  return (
    <Link to={to} className="group flex items-center gap-3 rounded-lg border p-3 hover:bg-accent transition-colors">
      <div className={`rounded-md p-2 ${tints[tint]}`}><Icon className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{sub}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function LecturerDashboard({ userId, name }: { userId: string; name: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["lecturer-dashboard", userId],
    queryFn: async () => {
      const { data: mods } = await supabase
        .from("modules")
        .select("id, code, title, qualification_id, qualifications(code, title)")
        .eq("lecturer_id", userId)
        .order("code");
      const modules = mods ?? [];
      const moduleIds = modules.map((m) => m.id);
      const qualIds = Array.from(new Set(modules.map((m) => m.qualification_id).filter(Boolean) as string[]));

      const [enrollRes, attRes] = await Promise.all([
        qualIds.length
          ? supabase.from("enrollments").select("student_id, qualification_id").in("qualification_id", qualIds)
          : Promise.resolve({ data: [] as { student_id: string; qualification_id: string }[] }),
        moduleIds.length
          ? supabase.from("attendance").select("status, module_id").in("module_id", moduleIds)
          : Promise.resolve({ data: [] as { status: string; module_id: string }[] }),
      ]);

      const enrollments = enrollRes.data ?? [];
      const attendance = attRes.data ?? [];

      const activeStudents = new Set(enrollments.map((e) => e.student_id)).size;

      const presentish = attendance.filter((a) => a.status === "present" || a.status === "late").length;
      const attPct = attendance.length ? Math.round((presentish / attendance.length) * 100) : 0;

      // per-module counts
      const enrollByQual = new Map<string, number>();
      for (const e of enrollments) {
        enrollByQual.set(e.qualification_id, (enrollByQual.get(e.qualification_id) ?? 0) + 1);
      }
      const attByMod = new Map<string, { total: number; ok: number }>();
      for (const a of attendance) {
        const cur = attByMod.get(a.module_id) ?? { total: 0, ok: 0 };
        cur.total += 1;
        if (a.status === "present" || a.status === "late") cur.ok += 1;
        attByMod.set(a.module_id, cur);
      }

      const modulesEnriched = modules.map((m) => {
        const enrolled = m.qualification_id ? enrollByQual.get(m.qualification_id) ?? 0 : 0;
        const att = attByMod.get(m.id);
        const pct = att && att.total ? Math.round((att.ok / att.total) * 100) : 0;
        return { ...m, enrolled, attendance: pct };
      });

      return {
        modules: modulesEnriched,
        activeStudents,
        attPct,
      };
    },
  });

  const stats = data;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome back, {name} 👋</h1>
            <p className="mt-1 flex items-center gap-2 text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              {stats ? `${stats.modules.length} module${stats.modules.length === 1 ? "" : "s"} you teach` : "Loading modules…"}
            </p>
          </div>
          <Button asChild variant="ghost" className="w-fit">
            <Link to="/lecturer/modules"><FolderOpen className="mr-2 h-4 w-4" /> Open module panel</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard
          icon={Users}
          label="Active Students"
          value={stats ? String(stats.activeStudents) : "—"}
          sub="Enrolled across your modules"
        />
        <MetricCard
          icon={CalendarCheck}
          label="Avg Attendance"
          value={stats ? `${stats.attPct}%` : "—"}
          sub="Across all your modules"
          progress={stats?.attPct}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>My Modules</CardTitle>
              <CardDescription>
                {stats ? `${stats.modules.length} module${stats.modules.length === 1 ? "" : "s"} you teach` : "Loading…"}
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/lecturer/modules"><Plus className="mr-1 h-4 w-4" /> Add module</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <div className="text-sm text-muted-foreground">Loading modules…</div>}
            {!isLoading && !stats?.modules.length && (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                You aren't teaching any modules yet.{" "}
                <Link to="/lecturer/modules" className="text-primary underline">Add one</Link>.
              </div>
            )}
            {stats?.modules.map((m) => (
              <Link
                key={m.id}
                to="/lecturer/modules/$id"
                params={{ id: m.id }}
                className="group flex items-center gap-4 rounded-md border p-3 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary font-semibold">
                  {m.code.slice(0, 3).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{m.code} — {m.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {m.qualifications?.code} · {m.qualifications?.title}
                  </div>
                </div>
                <div className="hidden text-right md:block">
                  <div className="text-sm font-semibold">{m.enrolled}</div>
                  <div className="text-xs text-muted-foreground">enrolled</div>
                </div>
                <div className="hidden w-28 md:block">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Attend.</span><span>{m.attendance}%</span>
                  </div>
                  <Progress value={m.attendance} className="h-1.5" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Jump straight in</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <QuickLink to="/lecturer/modules" icon={BookOpen} label="Manage my modules" />
            <QuickLink to="/lecturer/modules" icon={FileText} label="Upload study materials" />
            <QuickLink to="/lecturer/modules" icon={ClipboardList} label="Create an assessment" />
            <QuickLink to="/lecturer/modules" icon={CalendarCheck} label="Record attendance" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StudentDashboard({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["student-dashboard", userId],
    queryFn: async () => {
      const [subsRes, chatsRes, attRes, pubRes] = await Promise.all([
        supabase
          .from("submissions")
          .select("id, score, submitted_at, graded_at, assessments(id, title, type, total_marks, module_id)")
          .eq("student_id", userId)
          .order("submitted_at", { ascending: false }),
        supabase
          .from("ai_chats")
          .select("id, title, created_at", { count: "exact" })
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("attendance")
          .select("status, date, module_id")
          .eq("student_id", userId),
        supabase
          .from("assessments")
          .select("id, title, type, module_id, due_at, created_at")
          .eq("published", true)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const subs = subsRes.data ?? [];
      const chats = chatsRes.data ?? [];
      const aiCount = chatsRes.count ?? chats.length;
      const att = attRes.data ?? [];
      const pubs = pubRes.data ?? [];

      // Average %
      const pcts = subs
        .map((s) => {
          const tot = Number(s.assessments?.total_marks || 0);
          return tot > 0 ? (Number(s.score ?? 0) / tot) * 100 : null;
        })
        .filter((v): v is number => v !== null);
      const avgPct = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
      const gpa = +((avgPct / 100) * 4).toFixed(2);

      // Attendance
      const presentish = att.filter((a) => a.status === "present" || a.status === "late").length;
      const attPct = att.length ? Math.round((presentish / att.length) * 100) : 0;

      // Module map for labels
      const moduleIds = Array.from(
        new Set(
          [
            ...subs.map((s) => s.assessments?.module_id),
            ...pubs.map((p) => p.module_id),
            ...att.map((a) => a.module_id),
          ].filter(Boolean) as string[],
        ),
      );
      const { data: mods } = moduleIds.length
        ? await supabase.from("modules").select("id, code, title").in("id", moduleIds)
        : { data: [] };
      const modById = Object.fromEntries((mods ?? []).map((m) => [m.id, m]));

      // Activity feed: recent submissions + recently published assessments
      type Activity = {
        kind: "graded" | "submitted" | "published";
        at: string;
        title: string;
        module?: string;
        meta?: string;
      };
      const activity: Activity[] = [];
      for (const s of subs.slice(0, 10)) {
        const mod = s.assessments ? modById[s.assessments.module_id]?.code : undefined;
        const tot = Number(s.assessments?.total_marks || 0);
        const pct = tot > 0 ? Math.round((Number(s.score ?? 0) / tot) * 100) : null;
        activity.push({
          kind: s.graded_at ? "graded" : "submitted",
          at: s.graded_at ?? s.submitted_at,
          title: s.assessments?.title ?? "Assessment",
          module: mod,
          meta: pct !== null ? `${s.score}/${s.assessments?.total_marks} (${pct}%)` : s.assessments?.type,
        });
      }
      for (const p of pubs.slice(0, 5)) {
        activity.push({
          kind: "published",
          at: p.created_at ?? new Date().toISOString(),
          title: p.title,
          module: modById[p.module_id]?.code,
          meta: p.type,
        });
      }
      activity.sort((a, b) => +new Date(b.at) - +new Date(a.at));

      return { avgPct: Math.round(avgPct), gpa, aiCount, attPct, attCount: att.length, activity: activity.slice(0, 8), subCount: subs.length };
    },
  });

  const stats = data;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          icon={Award}
          label="Average GPA"
          value={stats ? `${stats.gpa.toFixed(2)} / 4.0` : "—"}
          sub={stats ? `${stats.avgPct}% across ${stats.subCount} assessment${stats.subCount === 1 ? "" : "s"}` : "No marks yet"}
          progress={stats?.avgPct}
        />
        <MetricCard
          icon={Brain}
          label="AI Sessions"
          value={stats ? String(stats.aiCount) : "—"}
          sub="Study tutor chats started"
        />
        <MetricCard
          icon={CalendarCheck}
          label="Avg Attendance"
          value={stats ? `${stats.attPct}%` : "—"}
          sub={stats ? `${stats.attCount} class${stats.attCount === 1 ? "" : "es"} recorded` : "No records yet"}
          progress={stats?.attPct}
        />
        <MetricCard
          icon={ClipboardList}
          label="Submissions"
          value={stats ? String(stats.subCount) : "—"}
          sub="Total assessments completed"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Course Activity</CardTitle>
            <CardDescription>Recent marks, submissions, and new assessments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <div className="text-sm text-muted-foreground">Loading activity…</div>}
            {!isLoading && !stats?.activity.length && (
              <div className="text-sm text-muted-foreground">No recent activity yet. Enroll in a qualification to get started.</div>
            )}
            {stats?.activity.map((a, i) => (
              <div key={i} className="flex items-start gap-3 rounded-md border p-3">
                <div className="rounded-md bg-accent p-2 text-accent-foreground">
                  {a.kind === "graded" ? <Award className="h-4 w-4" /> : a.kind === "published" ? <ClipboardList className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.title}</span>
                    {a.module && <Badge variant="secondary">{a.module}</Badge>}
                    <Badge variant="outline" className="capitalize">{a.kind}</Badge>
                  </div>
                  {a.meta && <div className="text-sm text-muted-foreground">{a.meta}</div>}
                  <div className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Jump straight in</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <QuickLink to="/student/assessments" icon={ClipboardList} label="Take an assessment" />
            <QuickLink to="/student/marks" icon={FileText} label="View my marks" />
            <QuickLink to="/student/tutor" icon={Brain} label="Open AI study tutor" />
            <QuickLink to="/student/courses" icon={BookOpen} label="My courses" />
            <QuickLink to="/student/enroll" icon={Layers} label="Browse qualifications" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function StaffOverview() {
  const { data: stats } = useQuery({
    queryKey: ["staff-stats"],
    queryFn: async () => {
      const [mods, users, quals] = await Promise.all([
        supabase.from("modules").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("qualifications").select("id", { count: "exact", head: true }),
      ]);
      return { modules: mods.count ?? 0, users: users.count ?? 0, quals: quals.count ?? 0 };
    },
  });
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <MetricCard icon={BookOpen} label="Modules" value={String(stats?.modules ?? 0)} />
      <MetricCard icon={GraduationCap} label="Qualifications" value={String(stats?.quals ?? 0)} />
      <MetricCard icon={Users} label="Users" value={String(stats?.users ?? 0)} />
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  progress,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  progress?: number;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-accent p-2 text-accent-foreground"><Icon className="h-5 w-5" /></div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        {typeof progress === "number" && <Progress value={progress} className="h-1.5" />}
      </CardContent>
    </Card>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors">
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}
