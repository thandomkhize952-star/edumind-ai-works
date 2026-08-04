import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AT_RISK_MARK_PCT = 50;
const AT_RISK_ATTENDANCE_PCT = 60;

export type AtRiskStudent = {
  student_id: string;
  full_name: string | null;
  email: string | null;
  student_number: string | null;
  module_id: string;
  module_code: string;
  module_title: string;
  avg_mark_pct: number | null;
  graded_count: number;
  attendance_pct: number | null;
  attendance_count: number;
  last_notified_at: string | null;
};

export const getAtRiskStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Modules taught by this lecturer
    const { data: modules } = await supabase
      .from("modules")
      .select("id, code, title, qualification_id")
      .eq("lecturer_id", userId);
    const mods = modules ?? [];
    if (!mods.length) return [] as AtRiskStudent[];

    const moduleIds = mods.map((m) => m.id);
    const qualIds = Array.from(new Set(mods.map((m) => m.qualification_id).filter(Boolean) as string[]));

    // 2. Enrollments for those qualifications
    const { data: enrolls } = await supabaseAdmin
      .from("enrollments")
      .select("student_id, qualification_id")
      .eq("status", "approved")
      .in("qualification_id", qualIds);
    const enrollments = enrolls ?? [];

    // 3. Assessments + submissions for those modules
    const { data: assessments } = await supabase
      .from("assessments")
      .select("id, module_id, total_marks")
      .in("module_id", moduleIds);
    const assessmentIds = (assessments ?? []).map((a) => a.id);
    const assessMap = new Map((assessments ?? []).map((a) => [a.id, a]));

    const { data: subs } = assessmentIds.length
      ? await supabaseAdmin
          .from("submissions")
          .select("student_id, assessment_id, score, graded_at")
          .in("assessment_id", assessmentIds)
          .not("graded_at", "is", null)
      : { data: [] as { student_id: string; assessment_id: string; score: number | null; graded_at: string | null }[] };

    // 4. Attendance
    const { data: att } = await supabase
      .from("attendance")
      .select("student_id, module_id, status")
      .in("module_id", moduleIds);

    // 5. Student profiles
    const studentIds = Array.from(new Set(enrollments.map((e) => e.student_id)));
    const { data: profs } = studentIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, full_name, email, student_number")
          .in("id", studentIds)
      : { data: [] as { id: string; full_name: string | null; email: string | null; student_number: string | null }[] };
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));

    // 6. Last at-risk notification per (student, module)
    const { data: notes } = await supabase
      .from("notifications")
      .select("user_id, module_id, created_at")
      .eq("sender_id", userId)
      .eq("kind", "at_risk")
      .in("module_id", moduleIds)
      .order("created_at", { ascending: false });
    const noteMap = new Map<string, string>();
    for (const n of notes ?? []) {
      const key = `${n.user_id}:${n.module_id}`;
      if (!noteMap.has(key) && n.created_at) noteMap.set(key, n.created_at);
    }

    // Aggregate per (student, module)
    const result: AtRiskStudent[] = [];

    for (const m of mods) {
      const studentsInMod = enrollments
        .filter((e) => e.qualification_id === m.qualification_id)
        .map((e) => e.student_id);

      for (const sid of studentsInMod) {
        const studentSubs = (subs ?? []).filter(
          (s) => s.student_id === sid && assessMap.get(s.assessment_id)?.module_id === m.id,
        );
        const pcts = studentSubs
          .map((s) => {
            const tot = Number(assessMap.get(s.assessment_id)?.total_marks || 0);
            return tot > 0 ? (Number(s.score ?? 0) / tot) * 100 : null;
          })
          .filter((v): v is number => v !== null);
        const avgMark = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;

        const attRows = (att ?? []).filter((a) => a.student_id === sid && a.module_id === m.id);
        const okCount = attRows.filter((a) => a.status === "present" || a.status === "late").length;
        const attPct = attRows.length ? (okCount / attRows.length) * 100 : null;

        // Flag purely on marks: average below 50% regardless of attendance
        if (avgMark === null) continue;
        if (avgMark >= AT_RISK_MARK_PCT) continue;

        const p = profMap.get(sid);
        if (!p) continue;

        result.push({
          student_id: sid,
          full_name: p.full_name,
          email: p.email,
          student_number: p.student_number,
          module_id: m.id,
          module_code: m.code,
          module_title: m.title,
          avg_mark_pct: Math.round(avgMark),
          graded_count: pcts.length,
          attendance_pct: Math.round(attPct),
          attendance_count: attRows.length,
          last_notified_at: noteMap.get(`${sid}:${m.id}`) ?? null,
        });
      }
    }

    result.sort((a, b) => (a.avg_mark_pct ?? 0) - (b.avg_mark_pct ?? 0));
    return result;
  });

export const notifyAtRiskStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        studentId: z.string().uuid(),
        moduleId: z.string().uuid(),
        message: z.string().min(1).max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Confirm lecturer owns this module
    const { data: mod } = await supabase
      .from("modules")
      .select("id, code, title, lecturer_id")
      .eq("id", data.moduleId)
      .maybeSingle();
    if (!mod || mod.lecturer_id !== userId) throw new Error("Forbidden");

    const body =
      data.message?.trim() ||
      `Your current performance in ${mod.code} — ${mod.title} indicates you're at risk of failing this module. Please reach out to your lecturer to discuss support and next steps.`;

    const { error } = await supabase.from("notifications").insert({
      user_id: data.studentId,
      sender_id: userId,
      module_id: data.moduleId,
      kind: "at_risk",
      title: `Heads up: you're at risk in ${mod.code}`,
      body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("notifications")
      .select("id, kind, title, body, module_id, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
