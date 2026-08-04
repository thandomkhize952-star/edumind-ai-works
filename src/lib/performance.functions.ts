import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LearnerPerformance = {
  student_id: string;
  full_name: string | null;
  email: string | null;
  student_number: string | null;
  avg_mark_pct: number | null;
  graded_count: number;
  attendance_pct: number | null;
  attendance_count: number;
};

export type ModulePerformance = {
  module_id: string;
  module_code: string;
  module_title: string;
  qualification: string | null;
  learners: LearnerPerformance[];
  module_avg_mark: number | null;
  module_avg_attendance: number | null;
};

export const getLecturerPerformance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ModulePerformance[]> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: modules } = await supabase
      .from("modules")
      .select("id, code, title, qualification_id, qualifications(code,title)")
      .eq("lecturer_id", userId)
      .order("code");
    const mods = modules ?? [];
    if (!mods.length) return [];

    const moduleIds = mods.map((m) => m.id);
    const qualIds = Array.from(new Set(mods.map((m) => m.qualification_id).filter(Boolean) as string[]));

    const { data: enrolls } = await supabaseAdmin
      .from("enrollments")
      .select("student_id, qualification_id")
      .eq("status", "approved")
      .in("qualification_id", qualIds);

    const { data: assessments } = await supabase
      .from("assessments")
      .select("id, module_id, total_marks")
      .in("module_id", moduleIds);
    const assessMap = new Map((assessments ?? []).map((a) => [a.id, a]));
    const assessmentIds = (assessments ?? []).map((a) => a.id);

    const { data: subs } = assessmentIds.length
      ? await supabaseAdmin
          .from("submissions")
          .select("student_id, assessment_id, score, graded_at")
          .in("assessment_id", assessmentIds)
          .not("graded_at", "is", null)
      : { data: [] as { student_id: string; assessment_id: string; score: number | null; graded_at: string | null }[] };

    const { data: att } = await supabase
      .from("attendance")
      .select("student_id, module_id, status")
      .in("module_id", moduleIds);

    const studentIds = Array.from(new Set((enrolls ?? []).map((e) => e.student_id)));
    const { data: profs } = studentIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, full_name, email, student_number")
          .in("id", studentIds)
      : { data: [] as { id: string; full_name: string | null; email: string | null; student_number: string | null }[] };
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));

    const result: ModulePerformance[] = [];

    for (const m of mods) {
      const students = (enrolls ?? [])
        .filter((e) => e.qualification_id === m.qualification_id)
        .map((e) => e.student_id);

      const learners: LearnerPerformance[] = [];
      for (const sid of students) {
        const p = profMap.get(sid);
        if (!p) continue;

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

        learners.push({
          student_id: sid,
          full_name: p.full_name,
          email: p.email,
          student_number: p.student_number,
          avg_mark_pct: avgMark === null ? null : Math.round(avgMark),
          graded_count: pcts.length,
          attendance_pct: attPct === null ? null : Math.round(attPct),
          attendance_count: attRows.length,
        });
      }

      learners.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

      const markVals = learners.map((l) => l.avg_mark_pct).filter((v): v is number => v !== null);
      const attVals = learners.map((l) => l.attendance_pct).filter((v): v is number => v !== null);

      result.push({
        module_id: m.id,
        module_code: m.code,
        module_title: m.title,
        qualification: m.qualifications ? `${m.qualifications.code} — ${m.qualifications.title}` : null,
        learners,
        module_avg_mark: markVals.length ? Math.round(markVals.reduce((a, b) => a + b, 0) / markVals.length) : null,
        module_avg_attendance: attVals.length ? Math.round(attVals.reduce((a, b) => a + b, 0) / attVals.length) : null,
      });
    }

    return result;
  });
