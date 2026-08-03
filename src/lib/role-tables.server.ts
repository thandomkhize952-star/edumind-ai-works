// Server-only helper that mirrors a profile into the role-specific tables
// (students / lecturers) based on the user's roles.

export async function syncRoleTables(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (!profile) return { student: false, lecturer: false };

  const roleList = (roles ?? []).map((r) => r.role as string);
  const isStudent = roleList.includes("student");
  const isLecturer = roleList.includes("lecturer");

  const client = supabaseAdmin as unknown as {
    from: (t: string) => any;
  };

  try {
    if (isStudent) {
      await client.from("students").upsert(
        {
          id: userId,
          student_number: profile.student_number,
          full_name: profile.full_name,
          email: profile.email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
    } else {
      await client.from("students").delete().eq("id", userId);
    }

    if (isLecturer) {
      await client.from("lecturers").upsert(
        {
          id: userId,
          full_name: profile.full_name,
          email: profile.email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
    } else {
      await client.from("lecturers").delete().eq("id", userId);
    }
  } catch (err) {
    // Tables may not exist yet in the external database - never block signup.
    console.error("[role-tables] sync failed", err);
  }

  return { student: isStudent, lecturer: isLecturer };
}
