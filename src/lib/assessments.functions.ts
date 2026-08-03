import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Returns assessment + questions WITHOUT correct_index (for students)
export const getAssessmentForStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ assessmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify access via RLS-aware client
    const { data: a, error: aerr } = await supabase
      .from("assessments")
      .select("*")
      .eq("id", data.assessmentId)
      .maybeSingle();
    if (aerr || !a) throw new Error("Assessment not found or not accessible");

    // Use admin to fetch questions (RLS hides them from students) but strip correct_index
    const { data: qs } = await supabaseAdmin
      .from("assessment_questions")
      .select("id, position, question, options, marks")
      .eq("assessment_id", data.assessmentId)
      .order("position");

    const { data: sub } = await supabase
      .from("submissions")
      .select("*")
      .eq("assessment_id", data.assessmentId)
      .eq("student_id", userId)
      .maybeSingle();

    // Reveal correct answers only after the student has submitted an auto-marked assessment
    const revealAnswers = !!sub && (a.type === "quiz" || a.type === "test");
    let questions: any[] = qs ?? [];
    if (revealAnswers) {
      const { data: full } = await supabaseAdmin
        .from("assessment_questions")
        .select("id, position, question, options, marks, correct_index")
        .eq("assessment_id", data.assessmentId)
        .order("position");
      questions = full ?? questions;
    }

    return { assessment: a, questions, submission: sub, revealAnswers };
  });

// Submit + auto-grade MCQ
export const submitAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        assessmentId: z.string().uuid(),
        answers: z.record(z.string(), z.union([z.number().int().min(0), z.string()])),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: a } = await supabase
      .from("assessments")
      .select("*")
      .eq("id", data.assessmentId)
      .maybeSingle();
    if (!a) throw new Error("Assessment not found");

    const autoGrade = a.type === "quiz" || a.type === "test";
    let score: number | null = null;
    const now = new Date().toISOString();

    if (autoGrade) {
      const { data: qs } = await supabaseAdmin
        .from("assessment_questions")
        .select("id, correct_index, marks")
        .eq("assessment_id", data.assessmentId);
      score = 0;
      for (const q of qs ?? []) {
        if (data.answers[q.id] === q.correct_index) score += Number(q.marks);
      }
    }

    const { error } = await supabaseAdmin.from("submissions").upsert(
      {
        assessment_id: data.assessmentId,
        student_id: userId,
        answers: data.answers,
        score,
        submitted_at: now,
        graded_at: autoGrade ? now : null,
      },
      { onConflict: "assessment_id,student_id" },
    );
    if (error) throw error;
    return { score, autoGraded: autoGrade };
  });

