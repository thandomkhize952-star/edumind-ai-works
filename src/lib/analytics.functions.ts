import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admin only");
}

export const getAdminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [quals, mods, enrolls, roles, profiles, chats] = await Promise.all([
      supabaseAdmin.from("qualifications").select("id, code, title").order("title"),
      supabaseAdmin.from("modules").select("id, code, title, qualification_id, lecturer_id").order("title"),
      supabaseAdmin.from("enrollments").select("student_id, qualification_id"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("profiles").select("id, full_name, email"),
      supabaseAdmin.from("ai_chats").select("id, user_id, created_at"),
    ]);

    const profById = new Map((profiles.data ?? []).map((p) => [p.id, p]));
    const qualById = new Map((quals.data ?? []).map((q) => [q.id, q]));

    const lecturerIds = new Set((roles.data ?? []).filter((r) => r.role === "lecturer").map((r) => r.user_id));
    const studentIds = new Set((roles.data ?? []).filter((r) => r.role === "student").map((r) => r.user_id));

    const lecturers = [...lecturerIds].map((id) => {
      const p = profById.get(id);
      return { id, full_name: p?.full_name ?? "—", email: p?.email ?? "—" };
    });

    const enrolledStudents = [...new Set((enrolls.data ?? []).map((e) => e.student_id))].map((id) => {
      const p = profById.get(id);
      const en = (enrolls.data ?? []).find((e) => e.student_id === id);
      const q = en ? qualById.get(en.qualification_id) : null;
      return {
        id,
        full_name: p?.full_name ?? "—",
        email: p?.email ?? "—",
        qualification: q ? `${q.code} — ${q.title}` : "—",
      };
    });

    const qualifications = (quals.data ?? []).map((q) => ({
      ...q,
      module_count: (mods.data ?? []).filter((m) => m.qualification_id === q.id).length,
      enrollment_count: (enrolls.data ?? []).filter((e) => e.qualification_id === q.id).length,
    }));

    const modules = (mods.data ?? []).map((m) => {
      const q = qualById.get(m.qualification_id);
      const lec = m.lecturer_id ? profById.get(m.lecturer_id) : null;
      return {
        id: m.id,
        code: m.code,
        title: m.title,
        qualification: q ? `${q.code} — ${q.title}` : "—",
        lecturer: lec?.full_name ?? "Unassigned",
      };
    });

    return {
      totals: {
        qualifications: qualifications.length,
        modules: modules.length,
        lecturers: lecturers.length,
        students: studentIds.size,
        enrolled_students: enrolledStudents.length,
        ai_sessions: (chats.data ?? []).length,
      },
      qualifications,
      modules,
      lecturers,
      enrolledStudents,
      generated_at: new Date().toISOString(),
    };
  });
