import { createFileRoute, Outlet, redirect, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUserContext } from "@/lib/user.functions";
import { GraduationCap, LayoutDashboard, Users, BookOpen, Layers, ClipboardList, FileText, Brain, UserCog, LogOut, CalendarCheck, Library, AlertTriangle, Bell, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedShell,
});

function AuthedShell() {
  const fetchCtx = useServerFn(getCurrentUserContext);
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => fetchCtx() });
  const router = useRouter();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const roles = data?.roles ?? [];
  const isAdmin = roles.includes("admin");
  const isLecturer = roles.includes("lecturer");
  const isStudent = roles.includes("student") || roles.length === 0;

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    // Student
    { to: "/student/courses", label: "My Courses", icon: BookOpen, show: isStudent },
    { to: "/student/assessments", label: "Assessments", icon: ClipboardList, show: isStudent },
    { to: "/student/marks", label: "My Marks", icon: FileText, show: isStudent },
    { to: "/student/tutor", label: "AI Study Tutor", icon: Brain, show: isStudent },
    { to: "/student/enroll", label: "Browse Qualifications", icon: Library, show: isStudent },
    { to: "/student/notifications", label: "Notifications", icon: Bell, show: isStudent },
    { to: "/student/profile", label: "My Profile", icon: UserCog, show: isStudent },
    // Lecturer
    { to: "/lecturer/modules", label: "My Modules", icon: BookOpen, show: isLecturer },
    { to: "/lecturer/performance", label: "Performance", icon: BarChart3, show: isLecturer },
    { to: "/lecturer/at-risk", label: "At-Risk Students", icon: AlertTriangle, show: isLecturer },
    { to: "/student/tutor", label: "AI Tutor", icon: Brain, show: isLecturer },
    { to: "/lecturer/profile", label: "My Profile", icon: UserCog, show: isLecturer },
    // Admin
    { to: "/admin/users", label: "Users", icon: Users, show: isAdmin },
    { to: "/admin/qualifications", label: "Qualifications", icon: Layers, show: isAdmin },
    { to: "/admin/modules", label: "Modules", icon: BookOpen, show: isAdmin },
    { to: "/admin/enrollments", label: "Enrollments", icon: CalendarCheck, show: isAdmin },
    { to: "/admin/analytics", label: "Analytics", icon: BarChart3, show: isAdmin },
  ];

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-r bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-4">
          <div className="rounded-lg bg-sidebar-primary p-2 text-sidebar-primary-foreground"><GraduationCap className="h-5 w-5" /></div>
          <span className="text-lg font-semibold">EduMind AI</span>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {nav.filter((n) => n.show).map((n) => {
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            return (
              <Link key={n.to} to={n.to} className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}>
                <n.icon className="h-4 w-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 px-2 text-xs text-sidebar-foreground/60">
            <div className="truncate font-medium text-sidebar-foreground">{data?.profile?.full_name || data?.profile?.email || "…"}</div>
            <div className="truncate">{roles.join(", ") || "student"}</div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="min-h-screen bg-background">
        <div className="lg:hidden flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary" /><span className="font-semibold">EduMind AI</span></div>
          <Button size="sm" variant="ghost" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
