import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Aggregated data for lecturer module detail page (joins profile names)
export const getLecturerModuleDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ moduleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: module, error } = await supabase
      .from("modules")
      .select("*, qualifications(code,title)")
      .eq("id", data.moduleId)
      .maybeSingle();
    if (error || !module) throw new Error("Module not found");

    // Authorize: admin or assigned lecturer
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin && module.lecturer_id !== userId) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Enrolled students for this module's qualification
    const { data: enrolls } = await supabaseAdmin
      .from("enrollments")
      .select("student_id")
      .eq("qualification_id", module.qualification_id);
    const studentIds = (enrolls ?? []).map(e => e.student_id);
    const { data: students } = studentIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email, student_number").in("id", studentIds)
      : { data: [] };

    const { data: assessments } = await supabase
      .from("assessments")
      .select("*")
      .eq("module_id", data.moduleId)
      .order("created_at", { ascending: false });

    const { data: materials } = await supabase
      .from("materials")
      .select("*")
      .eq("module_id", data.moduleId)
      .order("created_at", { ascending: false });

    return {
      module,
      students: students ?? [],
      assessments: assessments ?? [],
      materials: materials ?? [],
    };
  });

export const getModuleSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ assessmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: subs } = await supabase
      .from("submissions")
      .select("*")
      .eq("assessment_id", data.assessmentId)
      .order("submitted_at", { ascending: false });
    const ids = Array.from(new Set((subs ?? []).map(s => s.student_id)));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email, student_number").in("id", ids)
      : { data: [] };
    const byId = Object.fromEntries((profs ?? []).map(p => [p.id, p]));
    return (subs ?? []).map(s => ({ ...s, student: byId[s.student_id] ?? null }));
  });
