import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/** study_plans / study_plan_tasks are not in the generated types yet. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseClient = SupabaseClient<any, "public", any>;

export type StudyPlan = {
  id: string;
  student_id: string;
  qualification_id: string | null;
  title: string;
  description: string | null;
  ai_generated: boolean;
  created_at: string;
};

export type StudyPlanTask = {
  id: string;
  plan_id: string;
  position: number;
  title: string;
  description: string | null;
  duration_minutes: number;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "completed";
  due_date: string | null;
};

export const listStudyPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as LooseClient;
    const { data: plans } = await db
      .from("study_plans")
      .select("*")
      .eq("student_id", context.userId)
      .order("created_at", { ascending: false });

    const list = (plans ?? []) as StudyPlan[];
    if (list.length === 0) return [];

    const [{ data: tasks }, { data: quals }] = await Promise.all([
      db.from("study_plan_tasks").select("plan_id, status").in("plan_id", list.map((p) => p.id)),
      context.supabase.from("qualifications").select("id, title"),
    ]);

    return list.map((p) => {
      const t = ((tasks ?? []) as { plan_id: string; status: string }[]).filter((x) => x.plan_id === p.id);
      const done = t.filter((x) => x.status === "completed").length;
      return {
        ...p,
        qualification_title: (quals ?? []).find((q) => q.id === p.qualification_id)?.title ?? null,
        taskCount: t.length,
        completedCount: done,
        progress: t.length ? Math.round((done / t.length) * 1000) / 10 : 0,
      };
    });
  });

export const getStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as LooseClient;
    const { data: plan } = await db.from("study_plans").select("*").eq("id", data.planId).maybeSingle();
    if (!plan) throw new Error("Study plan not found");
    const { data: tasks } = await db
      .from("study_plan_tasks")
      .select("*")
      .eq("plan_id", data.planId)
      .order("position");
    let qualificationTitle: string | null = null;
    if ((plan as StudyPlan).qualification_id) {
      const { data: q } = await context.supabase
        .from("qualifications")
        .select("title")
        .eq("id", (plan as StudyPlan).qualification_id!)
        .maybeSingle();
      qualificationTitle = q?.title ?? null;
    }
    return { plan: plan as StudyPlan, tasks: (tasks ?? []) as StudyPlanTask[], qualificationTitle };
  });

export const updateTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        status: z.enum(["pending", "in_progress", "completed"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as LooseClient;
    const { error } = await db.from("study_plan_tasks").update({ status: data.status }).eq("id", data.taskId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as LooseClient;
    const { error } = await db
      .from("study_plans")
      .delete()
      .eq("id", data.planId)
      .eq("student_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

const AiPlanSchema = z.object({
  title: z.string(),
  description: z.string().optional().default("Personalized AI-generated study plan"),
  tasks: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional().default(""),
        duration_minutes: z.number().int().positive().max(480).optional().default(60),
        priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
        day_offset: z.number().int().min(0).max(120).optional().default(1),
      }),
    )
    .min(1),
});

/** Ask the AI Tutor to build a study plan for the student's registered qualification. */
export const generateStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        topic: z.string().max(500).optional(),
        qualificationId: z.string().uuid().optional(),
        days: z.number().int().min(3).max(60).optional().default(14),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = supabase as unknown as LooseClient;

    const lovableKey = getLovableKey();
    const geminiKey = process.env.GEMINI_API_KEY;
    const provider = lovableKey
      ? {
          apiKey: lovableKey,
          baseUrl: "https://ai.gateway.lovable.dev/v1/chat/completions",
          model: "openai/gpt-5.6-sol",
          extra: { reasoning_effort: "none" as const },
        }
      : geminiKey
        ? {
            apiKey: geminiKey,
            baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            model: "gemini-3.5-flash",
            extra: {},
          }
        : null;
    if (!provider) throw new Error("AI is not configured");

    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("qualification_id, qualifications ( id, code, title )")
      .eq("student_id", userId)
      .eq("status", "approved");

    const quals = (enrollments ?? [])
      .map(
        (e) =>
          (e as unknown as { qualifications: { id: string; code: string; title: string } | null })
            .qualifications,
      )
      .filter(Boolean) as { id: string; code: string; title: string }[];

    if (quals.length === 0) {
      throw new Error("You need an approved enrollment before the AI Tutor can build a study plan.");
    }

    const qual = quals.find((q) => q.id === data.qualificationId) ?? quals[0];

    const { data: modules } = await supabase
      .from("modules")
      .select("code, title, description")
      .eq("qualification_id", qual.id);

    const moduleList = (modules ?? [])
      .map((m) => `- ${m.code} — ${m.title}${m.description ? `: ${m.description}` : ""}`)
      .join("\n") || "- (no modules listed)";

    const prompt = `Build a ${data.days}-day study plan for a student registered for "${qual.code} — ${qual.title}".
Modules:
${moduleList}
${data.topic ? `Focus area requested by the student: ${data.topic}` : ""}

Return ONLY valid JSON (no markdown fences) shaped exactly like:
{"title":"...","description":"...","tasks":[{"title":"Task 1: Reading session","description":"...","duration_minutes":90,"priority":"high","day_offset":1}]}
Rules: 5-10 tasks, ordered, each tied to a real module above, durations 30-180 minutes, priority one of low|medium|high, day_offset is the number of days from today (1..${data.days}).`;

    const res = await fetch(provider.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({
        model: provider.model,
        ...provider.extra,
        messages: [
          { role: "system", content: "You are the EduMind AI Tutor. You output strict JSON study plans." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("AI is rate-limited. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
      throw new Error(`AI error: ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    let parsed: z.infer<typeof AiPlanSchema>;
    try {
      parsed = AiPlanSchema.parse(JSON.parse(cleaned.slice(start, end + 1)));
    } catch {
      throw new Error("The AI Tutor returned an unreadable plan. Please try again.");
    }

    const { data: created, error } = await db
      .from("study_plans")
      .insert({
        student_id: userId,
        qualification_id: qual.id,
        title: parsed.title,
        description: parsed.description,
        ai_generated: true,
      })
      .select("id")
      .single();
    if (error) throw error;

    const today = new Date();
    const rows = parsed.tasks.map((t, i) => {
      const due = new Date(today);
      due.setDate(due.getDate() + (t.day_offset ?? i + 1));
      return {
        plan_id: (created as { id: string }).id,
        position: i,
        title: t.title,
        description: t.description || null,
        duration_minutes: t.duration_minutes,
        priority: t.priority,
        status: "pending",
        due_date: due.toISOString().slice(0, 10),
      };
    });

    const { error: taskError } = await db.from("study_plan_tasks").insert(rows);
    if (taskError) throw taskError;

    return { planId: (created as { id: string }).id };
  });
