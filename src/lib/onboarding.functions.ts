import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function formatStudentNumber(seq: number) {
  const year = new Date().getFullYear().toString().slice(-2);
  return `S${year}${String(seq).padStart(5, "0")}`;
}

/**
 * Allocates a student number to the signed-in user if they are a student and
 * don't have one yet. Safe to call repeatedly - it's a no-op once allocated.
 */
export const ensureStudentNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, student_number").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    ]);

    const roleList = (roles ?? []).map((r) => r.role);
    const isStudent = roleList.length === 0 || roleList.includes("student");
    if (!isStudent) return { studentNumber: null };
    if (profile?.student_number) return { studentNumber: profile.student_number };

    const { data: latest } = await supabaseAdmin
      .from("profiles")
      .select("student_number")
      .not("student_number", "is", null)
      .order("student_number", { ascending: false })
      .limit(1);

    const last = latest?.[0]?.student_number ?? "";
    const lastSeq = /^S\d{7}$/.test(last) ? Number(last.slice(3)) : 0;

    // Retry a few times in case of a race on the unique-ish number.
    for (let i = 0; i < 5; i++) {
      const candidate = formatStudentNumber(Math.max(lastSeq, 999) + 1 + i);
      const { data: taken } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("student_number", candidate)
        .maybeSingle();
      if (taken) continue;

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ student_number: candidate })
        .eq("id", userId);
      if (!error) return { studentNumber: candidate };
    }

    return { studentNumber: null };
  });
