import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type EnrollmentRequest = {
  id: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  qualification_id: string;
  qualification_code: string | null;
  qualification_title: string | null;
  student_id: string;
  student_name: string | null;
  student_email: string | null;
  student_number: string | null;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

/** Student asks to enroll in a qualification; admins get a notification. */
export const requestEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qualificationId: string }) =>
    z.object({ qualificationId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: existing } = await supabase
      .from("enrollments")
      .select("id, status")
      .eq("student_id", userId)
      .in("status", ["pending", "approved"])
      .limit(1);
    if (existing && existing.length) {
      throw new Error(
        existing[0]!.status === "pending"
          ? "You already have an enrollment request awaiting approval."
          : "You are already enrolled in a qualification.",
      );
    }

    const { data: inserted, error } = await supabase
      .from("enrollments")
      .insert({ student_id: userId, qualification_id: data.qualificationId, status: "pending" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: admins }, { data: profile }, { data: qual }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
      supabaseAdmin.from("profiles").select("full_name, email, student_number").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("qualifications").select("code, title").eq("id", data.qualificationId).maybeSingle(),
    ]);
    const who = profile?.full_name || profile?.email || "A student";
    const rows = (admins ?? []).map((a) => ({
      user_id: a.user_id,
      sender_id: userId,
      kind: "enrollment_request",
      title: "New enrollment request",
      body: `${who}${profile?.student_number ? ` (${profile.student_number})` : ""} requested to enroll in ${qual?.code ?? ""} — ${qual?.title ?? ""}.`,
    }));
    if (rows.length) await supabaseAdmin.from("notifications").insert(rows);

    return { id: inserted?.id ?? null, status: "pending" as const };
  });

/** Admin: all enrollment rows with student + qualification details. */
export const listEnrollments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin
      .from("enrollments")
      .select("id, status, created_at, reviewed_at, student_id, qualification_id, qualifications(code, title)")
      .order("created_at", { ascending: false });
    const list = rows ?? [];
    const ids = Array.from(new Set(list.map((r) => r.student_id)));
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email, student_number").in("id", ids)
      : { data: [] as any[] };
    const byId = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

    return list.map((r): EnrollmentRequest => {
      const p = byId[r.student_id];
      const q = r.qualifications as { code?: string; title?: string } | null;
      return {
        id: r.id,
        status: (r as { status?: string }).status ?? "approved",
        created_at: r.created_at,
        reviewed_at: (r as { reviewed_at?: string | null }).reviewed_at ?? null,
        qualification_id: r.qualification_id,
        qualification_code: q?.code ?? null,
        qualification_title: q?.title ?? null,
        student_id: r.student_id,
        student_name: p?.full_name ?? null,
        student_email: p?.email ?? null,
        student_number: p?.student_number ?? null,
      };
    });
  });

/** Admin: accept or decline a pending enrollment request. */
export const reviewEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; decision: "approved" | "declined"; note?: string }) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "declined"]),
        note: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("enrollments")
      .update({
        status: data.decision,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        decision_note: data.note ?? null,
      })
      .eq("id", data.id)
      .select("student_id, qualification_id, qualifications(code, title)")
      .single();
    if (error) throw new Error(error.message);

    const q = row?.qualifications as { code?: string; title?: string } | null;
    const label = `${q?.code ?? ""} — ${q?.title ?? ""}`;
    await supabaseAdmin.from("notifications").insert({
      user_id: row!.student_id,
      sender_id: context.userId,
      kind: "enrollment_decision",
      title: data.decision === "approved" ? "Enrollment approved" : "Enrollment declined",
      body:
        data.decision === "approved"
          ? `Your enrollment in ${label} has been approved. You can now access your modules.`
          : `Your enrollment request for ${label} was declined.${data.note ? ` Reason: ${data.note}` : ""}`,
    });

    return { ok: true };
  });

/** Admin: remove an enrollment record. */
export const deleteEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("enrollments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
