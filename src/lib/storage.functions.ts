import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMaterialUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS on materials table is the real gate; signed URL just needs admin/service
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Re-verify access via RLS-bound client first
    const { data: m } = await context.supabase
      .from("materials")
      .select("file_path")
      .eq("file_path", data.path)
      .maybeSingle();
    if (!m) throw new Error("Not authorized");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("materials")
      .createSignedUrl(data.path, 60 * 10);
    if (error) throw error;
    return { url: signed.signedUrl };
  });
