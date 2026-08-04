import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

async function requireAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admin only");
}

const optDate = z.string().optional().nullable();

export const getUserReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        from: optDate,
        to: optDate,
        role: z.enum(["all", "admin", "lecturer", "student", "none"]).default("all"),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, student_number, created_at")
      .order("created_at", { ascending: false });
    if (data.from) q = q.gte("created_at", new Date(data.from).toISOString());
    if (data.to) q = q.lte("created_at", new Date(`${data.to}T23:59:59.999Z`).toISOString());

    const [{ data: profiles }, { data: roles }] = await Promise.all([
      q,
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);

    const rolesByUser: Record<string, string[]> = {};
    for (const r of roles ?? []) (rolesByUser[r.user_id] ??= []).push(r.role);

    const rows = (profiles ?? [])
      .map((p) => ({
        id: p.id,
        full_name: p.full_name ?? "—",
        email: p.email ?? "—",
        student_number: p.student_number ?? "",
        roles: (rolesByUser[p.id] ?? []).sort(),
        created_at: p.created_at,
      }))
      .filter((r) =>
        data.role === "all"
          ? true
          : data.role === "none"
            ? r.roles.length === 0
            : r.roles.includes(data.role),
      );

    return { rows, generated_at: new Date().toISOString() };
  });

export const getEnrollmentReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ from: optDate, to: optDate, qualificationId: z.string().optional().nullable() })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("enrollments")
      .select("id, student_id, qualification_id, created_at, status")
      .order("created_at", { ascending: false });
    if (data.from) q = q.gte("created_at", new Date(data.from).toISOString());
    if (data.to) q = q.lte("created_at", new Date(`${data.to}T23:59:59.999Z`).toISOString());
    if (data.qualificationId) q = q.eq("qualification_id", data.qualificationId);

    const [{ data: enrolls }, { data: profiles }, { data: quals }] = await Promise.all([
      q,
      supabaseAdmin.from("profiles").select("id, full_name, email, student_number"),
      supabaseAdmin.from("qualifications").select("id, code, title"),
    ]);

    const pById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const qById = new Map((quals ?? []).map((x) => [x.id, x]));

    const rows = (enrolls ?? []).map((e) => {
      const p = pById.get(e.student_id);
      const qq = qById.get(e.qualification_id);
      return {
        id: e.id,
        student_number: p?.student_number ?? "",
        full_name: p?.full_name ?? "—",
        email: p?.email ?? "—",
        qualification_code: qq?.code ?? "—",
        qualification_title: qq?.title ?? "—",
        status: e.status ?? "approved",
        enrolled_at: e.created_at,
      };
    });

    return { rows, generated_at: new Date().toISOString() };
  });

export const getModuleReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        qualificationId: z.string().optional().nullable(),
        lecturerId: z.string().optional().nullable(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("modules")
      .select("id, code, title, qualification_id, lecturer_id, created_at")
      .order("code");
    if (data.qualificationId) q = q.eq("qualification_id", data.qualificationId);
    if (data.lecturerId)
      q = data.lecturerId === "unassigned" ? q.is("lecturer_id", null) : q.eq("lecturer_id", data.lecturerId);

    const [{ data: modules }, { data: quals }, { data: profiles }, { data: assessments }, { data: materials }] =
      await Promise.all([
        q,
        supabaseAdmin.from("qualifications").select("id, code, title"),
        supabaseAdmin.from("profiles").select("id, full_name, email"),
        supabaseAdmin.from("assessments").select("id, module_id, type"),
        supabaseAdmin.from("materials").select("id, module_id"),
      ]);

    const qById = new Map((quals ?? []).map((x) => [x.id, x]));
    const pById = new Map((profiles ?? []).map((p) => [p.id, p]));

    const rows = (modules ?? []).map((m) => {
      const qq = qById.get(m.qualification_id);
      const lec = m.lecturer_id ? pById.get(m.lecturer_id) : null;
      const mAss = (assessments ?? []).filter((a) => a.module_id === m.id);
      return {
        id: m.id,
        code: m.code,
        title: m.title,
        qualification: qq ? `${qq.code} — ${qq.title}` : "—",
        lecturer: lec?.full_name ?? "Unassigned",
        lecturer_email: lec?.email ?? "",
        assessments: mAss.length,
        assignments: mAss.filter((a) => a.type === "assignment").length,
        quizzes: mAss.filter((a) => a.type !== "assignment").length,
        materials: (materials ?? []).filter((x) => x.module_id === m.id).length,
      };
    });

    return { rows, generated_at: new Date().toISOString() };
  });

export const getReportFilterOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: quals }, { data: roles }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from("qualifications").select("id, code, title").order("code"),
      supabaseAdmin.from("user_roles").select("user_id, role").eq("role", "lecturer"),
      supabaseAdmin.from("profiles").select("id, full_name, email"),
    ]);
    const pById = new Map((profiles ?? []).map((p) => [p.id, p]));
    return {
      qualifications: quals ?? [],
      lecturers: (roles ?? []).map((r) => ({
        id: r.user_id,
        name: pById.get(r.user_id)?.full_name ?? pById.get(r.user_id)?.email ?? r.user_id,
      })),
    };
  });

export const getMyTranscript = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: enrolls }] = await Promise.all([
      supabase.from("profiles").select("full_name, email, student_number").eq("id", userId).maybeSingle(),
      supabase.from("enrollments").select("qualification_id, created_at, qualifications(code, title)").eq("student_id", userId).eq("status", "approved"),
    ]);

    const qualIds = (enrolls ?? []).map((e) => e.qualification_id);
    const { data: modules } = qualIds.length
      ? await supabase.from("modules").select("id, code, title, qualification_id").in("qualification_id", qualIds)
      : { data: [] as { id: string; code: string; title: string; qualification_id: string }[] };

    const moduleIds = (modules ?? []).map((m) => m.id);
    const { data: assessments } = moduleIds.length
      ? await supabase.from("assessments").select("id, module_id, title, type, total_marks").in("module_id", moduleIds)
      : { data: [] as { id: string; module_id: string; title: string; type: string; total_marks: number }[] };

    const { data: subs } = await supabase
      .from("submissions")
      .select("assessment_id, score, submitted_at, graded_at")
      .eq("student_id", userId);

    const subByAssessment = new Map((subs ?? []).map((s) => [s.assessment_id, s]));

    const moduleRows = (modules ?? []).map((m) => {
      const mAss = (assessments ?? []).filter((a) => a.module_id === m.id);
      const graded = mAss
        .map((a) => ({ a, s: subByAssessment.get(a.id) }))
        .filter((x) => x.s && x.s.score !== null && Number(x.a.total_marks) > 0);
      const earned = graded.reduce((acc, x) => acc + Number(x.s!.score ?? 0), 0);
      const possible = graded.reduce((acc, x) => acc + Number(x.a.total_marks), 0);
      const percent = possible > 0 ? Math.round((earned / possible) * 1000) / 10 : null;
      return {
        module_id: m.id,
        qualification_id: m.qualification_id,
        code: m.code,
        title: m.title,
        assessments: mAss.length,
        completed: graded.length,
        marks_earned: earned,
        marks_possible: possible,
        percent,
        results: mAss.map((a) => {
          const s = subByAssessment.get(a.id);
          return {
            title: a.title,
            type: a.type,
            total_marks: a.total_marks,
            score: s?.score ?? null,
            submitted_at: s?.submitted_at ?? null,
          };
        }),
      };
    });

    const qualifications = (enrolls ?? []).map((e) => {
      const mods = moduleRows.filter((m) => m.qualification_id === e.qualification_id);
      const earned = mods.reduce((a, m) => a + m.marks_earned, 0);
      const possible = mods.reduce((a, m) => a + m.marks_possible, 0);
      const q = e.qualifications as unknown as { code: string; title: string } | null;
      return {
        id: e.qualification_id,
        code: q?.code ?? "—",
        title: q?.title ?? "—",
        enrolled_at: e.created_at,
        modules: mods,
        percent: possible > 0 ? Math.round((earned / possible) * 1000) / 10 : null,
        marks_earned: earned,
        marks_possible: possible,
      };
    });

    const totalEarned = qualifications.reduce((a, q) => a + q.marks_earned, 0);
    const totalPossible = qualifications.reduce((a, q) => a + q.marks_possible, 0);

    return {
      student: {
        full_name: profile?.full_name ?? "—",
        email: profile?.email ?? "—",
        student_number: profile?.student_number ?? "—",
      },
      qualifications,
      overall_percent: totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 1000) / 10 : null,
      generated_at: new Date().toISOString(),
    };
  });
