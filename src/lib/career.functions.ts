import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const db = (c: unknown) => c as SupabaseClient;

async function requireAdvisor(client: unknown, userId: string) {
  const { data } = await db(client).from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("career_advisor") && !roles.includes("admin")) {
    throw new Error("Career advisor access required");
  }
}

export type AdvisorReview = {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  file_name: string;
  status: string;
  score: number | null;
  summary: string | null;
  feedback: string | null;
  advisor_feedback: string | null;
  advisor_status: string;
  reviewed_at: string | null;
  created_at: string;
};

export const listAdvisorReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.enum(["all", "pending", "reviewed"]).default("all") }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<AdvisorReview[]> => {
    await requireAdvisor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = db(supabaseAdmin);

    let q = admin.from("cv_reviews").select("*").order("created_at", { ascending: false });
    if (data.status === "pending") q = q.neq("advisor_status", "reviewed");
    if (data.status === "reviewed") q = q.eq("advisor_status", "reviewed");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = [...new Set((rows ?? []).map((r: { student_id: string }) => r.student_id))];
    const { data: profiles } = ids.length
      ? await admin.from("profiles").select("id, full_name, email").in("id", ids)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    return (rows ?? []).map((r: any) => ({
      id: r.id,
      student_id: r.student_id,
      student_name: byId.get(r.student_id)?.full_name ?? "Student",
      student_email: byId.get(r.student_id)?.email ?? "",
      file_name: r.file_name,
      status: r.status,
      score: r.score ?? null,
      summary: r.summary ?? null,
      feedback: r.feedback ?? null,
      advisor_feedback: r.advisor_feedback ?? null,
      advisor_status: r.advisor_status ?? "pending",
      reviewed_at: r.reviewed_at ?? null,
      created_at: r.created_at,
    }));
  });

export const getAdvisorCvUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdvisor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await db(supabaseAdmin)
      .from("cv_reviews")
      .select("file_path")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("cvs")
      .createSignedUrl(row.file_path as string, 600);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

export const saveAdvisorReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        advisorFeedback: z.string().max(8000).default(""),
        advisorStatus: z.enum(["pending", "reviewed", "needs_revision"]).default("reviewed"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdvisor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await db(supabaseAdmin)
      .from("cv_reviews")
      .update({
        advisor_feedback: data.advisorFeedback,
        advisor_status: data.advisorStatus,
        advisor_id: context.userId,
        reviewed_at: data.advisorStatus === "reviewed" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
