import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Resolve lecturer display info for a set of modules.
 * Profiles are RLS-protected, so students cannot read lecturer rows directly.
 * This returns only non-sensitive display fields (name/email) for assigned lecturers.
 */
export const getModuleLecturers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ moduleIds: z.array(z.string().uuid()).min(1).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: mods } = await supabaseAdmin
      .from("modules")
      .select("id, lecturer_id")
      .in("id", data.moduleIds);

    const lecturerIds = Array.from(
      new Set((mods ?? []).map((m: any) => m.lecturer_id).filter(Boolean)),
    ) as string[];

    let byId = new Map<string, { full_name: string | null; email: string | null }>();
    if (lecturerIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", lecturerIds);
      byId = new Map((profs ?? []).map((p: any) => [p.id, { full_name: p.full_name, email: p.email }]));
    }

    const result: Record<string, { full_name: string | null; email: string | null } | null> = {};
    for (const m of mods ?? []) {
      const lec = (m as any).lecturer_id ? byId.get((m as any).lecturer_id) ?? null : null;
      result[(m as any).id] = lec;
    }
    return result;
  });
