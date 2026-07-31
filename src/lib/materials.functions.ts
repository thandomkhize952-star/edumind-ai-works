import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMaterialUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: signed, error } = await supabase.storage.from("materials").createSignedUrl(data.path, 60 * 10);
    if (error || !signed) throw new Error(error?.message || "Failed to sign URL");
    return { url: signed.signedUrl };
  });

export const uploadMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      moduleId: z.string().uuid(),
      title: z.string().min(1),
      description: z.string().optional().default(""),
      fileName: z.string().min(1),
      fileType: z.string().optional().default(""),
      fileBase64: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorize: admin or assigned lecturer
    const [{ data: isAdmin }, { data: isLecturer }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("is_module_lecturer", { _user_id: userId, _module_id: data.moduleId }),
    ]);
    if (!isAdmin && !isLecturer) throw new Error("Forbidden: you are not assigned to this module");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Decode base64 → Uint8Array
    const bytes = Uint8Array.from(atob(data.fileBase64), (c) => c.charCodeAt(0));
    const path = `${data.moduleId}/${crypto.randomUUID()}-${data.fileName}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("materials")
      .upload(path, bytes, { contentType: data.fileType || "application/octet-stream", upsert: false });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

    const { error: insErr } = await supabaseAdmin.from("materials").insert({
      module_id: data.moduleId,
      uploaded_by: userId,
      title: data.title,
      description: data.description || null,
      file_path: path,
      file_type: data.fileType || null,
    });
    if (insErr) {
      await supabaseAdmin.storage.from("materials").remove([path]);
      throw new Error(`DB insert failed: ${insErr.message}`);
    }

    return { ok: true, path };
  });

export const deleteMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ materialId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: mat, error: mErr } = await supabase.from("materials").select("id, module_id, file_path").eq("id", data.materialId).single();
    if (mErr || !mat) throw new Error(mErr?.message || "Material not found");

    const [{ data: isAdmin }, { data: isLecturer }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("is_module_lecturer", { _user_id: userId, _module_id: mat.module_id }),
    ]);
    if (!isAdmin && !isLecturer) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage.from("materials").remove([mat.file_path]);
    const { error } = await supabaseAdmin.from("materials").delete().eq("id", data.materialId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
