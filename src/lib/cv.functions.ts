import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { fetchAiWithRetry, aiErrorMessage } from "./ai-fetch.server";

const SYSTEM = `You are an experienced career advisor reviewing a student's CV/resume.
Return your answer in this exact format:

SCORE: <a number from 0 to 100>
SUMMARY: <one short sentence overall verdict>
FEEDBACK:
### Strengths
- ...
### Areas to improve
- ...
### Suggested rewrites
- ...
### Next steps
- ...

Be specific, practical and encouraging. Judge structure, clarity, impact statements, skills, formatting and relevance for graduate/entry-level roles.`;

function parseReview(text: string) {
  const score = Number(text.match(/SCORE:\s*(\d{1,3})/i)?.[1] ?? "");
  const summary = text.match(/SUMMARY:\s*(.+)/i)?.[1]?.trim() ?? "";
  const feedback = text.split(/FEEDBACK:\s*/i)[1]?.trim() || text.trim();
  return {
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null,
    summary,
    feedback,
  };
}

async function reviewWithAi(fileName: string, mimeType: string, dataUrl: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!lovableKey && !geminiKey) throw new Error("AI is not configured");

  const prompt = `Review the attached CV file "${fileName}".`;

  if (lovableKey) {
    const res = await fetchAiWithRetry(() =>
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
        body: JSON.stringify({
          model: "openai/gpt-5.6-sol",
          reasoning_effort: "none",
          messages: [
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                mimeType.startsWith("image/")
                  ? { type: "image_url", image_url: { url: dataUrl } }
                  : { type: "file", file: { filename: fileName, file_data: dataUrl } },
              ],
            },
          ],
        }),
      }),
    );
    if (!res.ok) throw new Error(aiErrorMessage(res.status, res.text));
    const json = res.json as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content ?? "";
  }

  const base64 = dataUrl.split(",").pop() ?? "";
  const res = await fetchAiWithRetry(() =>
    fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey! },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [
          { role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] },
        ],
      }),
    }),
  );
  if (!res.ok) throw new Error(aiErrorMessage(res.status, res.text));
  const json = res.json as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

export const submitCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1).max(200),
        mimeType: z.string().min(1).max(120),
        dataUrl: z.string().min(1).max(14_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const safeName = data.name.replace(/[^\w.\-]+/g, "_");
    const path = `${userId}/${Date.now()}-${safeName}`;
    const bytes = Uint8Array.from(atob(data.dataUrl.split(",").pop() ?? ""), (c) => c.charCodeAt(0));

    const { error: upErr } = await supabaseAdmin.storage
      .from("cvs")
      .upload(path, bytes, { contentType: data.mimeType, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: row, error } = await supabase
      .from("cv_reviews")
      .insert({ student_id: userId, file_name: data.name, file_path: path, status: "pending" })
      .select("id")
      .single();
    if (error) throw error;

    try {
      const raw = await reviewWithAi(data.name, data.mimeType, data.dataUrl);
      const parsed = parseReview(raw);
      await supabase
        .from("cv_reviews")
        .update({ status: "reviewed", score: parsed.score, summary: parsed.summary, feedback: parsed.feedback })
        .eq("id", row.id);
    } catch (e) {
      await supabase
        .from("cv_reviews")
        .update({ status: "failed", feedback: e instanceof Error ? e.message : "Review failed" })
        .eq("id", row.id);
      throw e;
    }

    return { id: row.id as string };
  });

export const listCvReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("cv_reviews")
      .select("*")
      .eq("student_id", context.userId)
      .order("created_at", { ascending: false });
    return (data ?? []) as {
      id: string;
      file_name: string;
      file_path: string;
      status: string;
      score: number | null;
      summary: string | null;
      feedback: string | null;
      created_at: string;
    }[];
  });

export const getCvUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("cv_reviews")
      .select("file_path")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("cvs")
      .createSignedUrl(row.file_path as string, 600);
    if (error) throw error;
    return { url: signed.signedUrl };
  });

export const deleteCvReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("cv_reviews").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
