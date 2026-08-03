import { createFileRoute, Outlet, redirect, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCurrentUserContext } from "@/lib/user.functions";
import { GraduationCap, LayoutDashboard, Users, BookOpen, Layers, ClipboardList, FileText, Brain, UserCog, LogOut, CalendarCheck, Library, AlertTriangle, Bell, BarChart3, FileSpreadsheet } from "lucide-react";
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

  type NavItem = { to: string; label: string; icon: typeof BookOpen };
  type NavGroup = { label: string; items: NavItem[] };

  const groups: NavGroup[] = [{ label: "Main", items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] }];

  if (isStudent) {
    groups.push(
      {
        label: "Learning",
        items: [
          { to: "/student/courses", label: "Courses", icon: BookOpen },
          { to: "/student/materials", label: "Materials", icon: Library },
          { to: "/student/quizzes", label: "Quizzes", icon: ClipboardList },
          { to: "/student/assignments", label: "Assignments", icon: FileText },
          { to: "/student/marks", label: "My Marks", icon: FileText },
        ],
      },
      { label: "AI Tutor", items: [{ to: "/student/tutor", label: "Chat with AI", icon: Brain }] },
      {
        label: "Account",
        items: [
          { to: "/student/notifications", label: "Notifications", icon: Bell },
          { to: "/student/profile", label: "My Profile", icon: UserCog },
        ],
      },
    );
  }

  if (isLecturer) {
    groups.push(
      {
        label: "Teaching",
        items: [
          { to: "/lecturer/modules", label: "My Modules", icon: BookOpen },
          { to: "/lecturer/performance", label: "Performance", icon: BarChart3 },
          { to: "/lecturer/at-risk", label: "At-Risk Students", icon: AlertTriangle },
        ],
      },
      { label: "Account", items: [{ to: "/lecturer/profile", label: "My Profile", icon: UserCog }] },
    );
  }

  if (isAdmin) {
    groups.push(
      {
        label: "Administration",
        items: [
          { to: "/admin/users", label: "Users", icon: Users },
          { to: "/admin/qualifications", label: "Qualifications", icon: Layers },
          { to: "/admin/modules", label: "Modules", icon: BookOpen },
          { to: "/admin/enrollments", label: "Enrollments", icon: CalendarCheck },
        ],
      },
      {
        label: "Insights",
        items: [
          { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
          { to: "/admin/reports", label: "Reports", icon: FileSpreadsheet },
        ],
      },
    );
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  const brand = (
    <div className="flex items-center gap-3">
      <div className="rounded-xl bg-gradient-to-br from-primary to-accent p-2.5 shadow-lg shadow-primary/25">
        <GraduationCap className="h-5 w-5 text-primary-foreground" />
      </div>
      <div className="leading-tight">
        <div className="text-lg font-bold tracking-tight text-sidebar-foreground">EduMind AI</div>
        <div className="text-xs text-sidebar-foreground/50">Learning Reimagined</div>
      </div>
    </div>
  );

  return (
    <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
      <aside className="hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <div className="px-5 py-6">{brand}</div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
          {groups.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                {group.label}
              </div>
              {group.items.map((n) => {
                const active = pathname === n.to || pathname.startsWith(n.to + "/");
                return (
                  <Link
                    key={group.label + n.to}
                    to={n.to}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-all",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <n.icon className={cn("h-[18px] w-[18px]", active ? "text-primary" : "text-sidebar-foreground/60 group-hover:text-primary")} />
                    {n.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 px-2 text-xs text-sidebar-foreground/60">
            <div className="truncate font-medium text-sidebar-foreground">{data?.profile?.full_name || data?.profile?.email || "…"}</div>
            <div className="truncate capitalize">{roles.join(", ") || "student"}</div>
          </div>
          <Button variant="ghost" className="w-full justify-start rounded-xl text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="min-h-screen bg-background">
        <div className="flex items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-3 lg:hidden">
          {brand}
          <Button size="sm" variant="ghost" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}

