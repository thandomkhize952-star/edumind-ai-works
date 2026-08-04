import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUserContext } from "@/lib/user.functions";
import { listAllUsers } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Award, Brain, CalendarCheck, ClipboardList, BookOpen, GraduationCap, Users, Layers, FileText, ArrowRight, FolderOpen, Plus, Zap, UserPlus, BarChart3, IdCard, UserRound, CheckCircle2, X, Trophy, Bot, Sparkles } from "lucide-react";
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

  if (isStudent && me?.userId) {
    return <StudentDashboard userId={me.userId} name={name} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {name}</h1>
        <p className="text-muted-foreground">
          Role{roles.length > 1 ? "s" : ""}: {roles.join(", ") || "student"}
        </p>
      </div>
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
          ? supabase.from("enrollments").select("student_id, qualification_id").eq("status", "approved").in("qualification_id", qualIds)
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

function StudentDashboard({ userId, name }: { userId: string; name: string }) {
  const [dismissed, setDismissed] = useState(false);

  const { data } = useQuery({
    queryKey: ["student-dashboard", userId],
    queryFn: async () => {
      const [subsRes, chatsRes, attRes, enrRes] = await Promise.all([
        supabase
          .from("submissions")
          .select("id, score, submitted_at, graded_at, assessments(id, title, type, total_marks, module_id)")
          .eq("student_id", userId)
          .order("submitted_at", { ascending: false }),
        supabase
          .from("ai_chats")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase.from("attendance").select("status, date").eq("student_id", userId).order("date", { ascending: false }),
        supabase.from("enrollments").select("qualification_id, qualifications(code, title)").eq("student_id", userId).eq("status", "approved"),
      ]);

      const subs = subsRes.data ?? [];
      const att = attRes.data ?? [];
      const enrolls = enrRes.data ?? [];

      const pcts = subs
        .map((s) => {
          const tot = Number(s.assessments?.total_marks || 0);
          return tot > 0 ? (Number(s.score ?? 0) / tot) * 100 : null;
        })
        .filter((v): v is number => v !== null);
      const avgPct = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
      const gpa = +((avgPct / 100) * 4).toFixed(1);

      const presentish = att.filter((a) => a.status === "present" || a.status === "late").length;
      const attPct = att.length ? (presentish / att.length) * 100 : 0;
      const attRecent = att.slice(0, 7).reverse().map((a) => a.status === "present" || a.status === "late");

      const quizzesTaken = subs.filter((s) => s.assessments && s.assessments.type !== "assignment").length;
      const assignments = subs.filter((s) => s.assessments?.type === "assignment").length;

      const q = enrolls[0]?.qualifications;
      return {
        gpa,
        avgPct,
        attPct,
        attRecent,
        aiCount: chatsRes.count ?? 0,
        courses: enrolls.length,
        qualification: q ? `${q.code} — ${q.title}` : null,
        quizzesTaken,
        assignments,
        gradedCount: pcts.length,
      };
    },
  });

  const gpa = data?.gpa ?? 0;
  const avgPct = data?.avgPct ?? 0;
  const attPct = data?.attPct ?? 0;
  const ring = 2 * Math.PI * 52;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6">
      {!dismissed && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-success/40 bg-success/10 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
            <span className="truncate text-base font-semibold">Welcome back, {name}!</span>
          </div>
          <button aria-label="Dismiss" onClick={() => setDismissed(true)} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        {/* Academic performance */}
        <Card className="glass overflow-hidden rounded-2xl">
          <CardContent className="flex h-full flex-col p-6">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/15 p-2.5 text-primary"><Trophy className="h-5 w-5" /></div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Academic Performance</div>
                </div>
                <div className="mt-6 flex items-end gap-1">
                  <span className="text-6xl font-bold leading-none tracking-tight">{gpa.toFixed(1)}</span>
                  <span className="pb-1 text-3xl font-semibold text-muted-foreground">/4.0</span>
                </div>
                <div className="mt-4 truncate text-base font-medium text-accent">{data?.qualification ?? "Not enrolled yet"}</div>
                <div className="text-sm text-muted-foreground">Overall grade: {avgPct.toFixed(1)}%</div>
              </div>

              <div className="relative h-32 w-32 shrink-0">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                  <defs>
                    <linearGradient id="gradeGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="oklch(0.62 0.20 285)" />
                      <stop offset="100%" stopColor="oklch(0.70 0.20 350)" />
                    </linearGradient>
                  </defs>
                  <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" r="52" fill="none" stroke="url(#gradeGrad)" strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={ring} strokeDashoffset={ring * (1 - Math.min(avgPct, 100) / 100)}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold leading-none">{avgPct.toFixed(1)}%</span>
                  <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Grade</span>
                </div>
              </div>
            </div>

            <div className="mt-auto grid grid-cols-3 divide-x divide-border border-t border-border pt-5 text-center">
              <MiniStat value={data?.quizzesTaken ?? 0} label="Quizzes Taken" />
              <MiniStat value={data?.assignments ?? 0} label="Assignments" />
              <MiniStat value={data?.courses ?? 0} label="Courses" />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Attendance */}
            <Card className="glass rounded-2xl">
              <CardContent className="p-5">
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                  <div className="rounded-xl bg-success/15 p-2.5 text-success"><CalendarCheck className="h-5 w-5" /></div>
                  {attPct < 75 && (
                    <span className="justify-self-end rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-warning">Needs Attention</span>
                  )}
                </div>
                <div className="mt-4 text-4xl font-bold tracking-tight">{attPct.toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground">Attendance Rate</div>
                <div className="mt-4 flex gap-1.5">
                  {(data?.attRecent?.length ? data.attRecent : Array(7).fill(false)).map((ok, i) => (
                    <div key={i} className={cn("h-6 flex-1 rounded-md", ok ? "bg-success/60" : "bg-success/15")} />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* AI sessions */}
            <Card className="glass rounded-2xl">
              <CardContent className="p-5">
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                  <div className="relative rounded-xl bg-accent/15 p-2.5 text-accent">
                    <Bot className="h-5 w-5" />
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent" />
                  </div>
                  <span className="justify-self-end rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">Live</span>
                </div>
                <div className="mt-4 text-4xl font-bold tracking-tight">{data?.aiCount ?? 0}</div>
                <div className="text-sm text-muted-foreground">AI Sessions</div>
                <Link to="/student/tutor" className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
                  Ask anything →
                </Link>
              </CardContent>
            </Card>
          </div>

          <RowCard
            to="/student/courses"
            icon={BookOpen}
            tint="bg-primary/15 text-primary"
            value={data?.courses ?? 0}
            label="Active Courses"
            progress={Math.min(((data?.courses ?? 0) / 6) * 100, 100)}
            progressLabel={`${data?.courses ?? 0}/6 max`}
          />
          <RowCard
            to="/student/assignments"
            icon={ClipboardList}
            tint="bg-fuchsia-500/15 text-fuchsia-300"
            value={data?.assignments ?? 0}
            label="Assignments"
            sub={`${data?.assignments ?? 0} submitted`}
          />
        </div>
      </div>

      <Card className="glass rounded-2xl border-accent/25">
        <CardContent className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 p-5">
          <div className="rounded-xl bg-accent/15 p-3 text-accent"><Sparkles className="h-5 w-5" /></div>
          <div className="min-w-0">
            <div className="font-semibold">AI Insight: your average is {avgPct.toFixed(1)}% across your assessments</div>
            <div className="text-sm text-muted-foreground">Keep your study streak going to reach your GPA goal.</div>
          </div>
          <Button asChild variant="secondary" className="rounded-xl">
            <Link to="/student/marks">View Details</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-2">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function RowCard({
  to, icon: Icon, tint, value, label, sub, progress, progressLabel,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
  value: number;
  label: string;
  sub?: string;
  progress?: number;
  progressLabel?: string;
}) {
  return (
    <Link to={to} className="glass group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl p-5 transition-colors hover:bg-sidebar-accent/40">
      <div className={cn("rounded-xl p-3", tint)}><Icon className="h-5 w-5" /></div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{value}</span>
          <span className="truncate text-sm text-muted-foreground">{label}</span>
        </div>
        {typeof progress === "number" && (
          <div className="mt-2 flex items-center gap-3">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${progress}%` }} />
            </div>
            {progressLabel && <span className="shrink-0 text-xs text-muted-foreground">{progressLabel}</span>}
          </div>
        )}
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
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
