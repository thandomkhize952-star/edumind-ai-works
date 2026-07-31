import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const aiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        chatId: z.string().uuid().optional(),
        message: z.string().min(1).max(4000),
        mode: z.enum(["chat", "practice", "summarize", "exam_plan"]).default("chat"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    // Get or create chat
    let chatId = data.chatId;
    if (!chatId) {
      const { data: c, error } = await supabase
        .from("ai_chats")
        .insert({ user_id: userId, title: data.message.slice(0, 60) })
        .select("id")
        .single();
      if (error) throw error;
      chatId = c.id;
    }

    // Load history
    const { data: history } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("chat_id", chatId)
      .order("created_at");

    const systemByMode: Record<string, string> = {
      chat: "You are a friendly study tutor helping a university student. Be concise, clear, and use markdown. Encourage active recall.",
      practice:
        "You are a study tutor. Generate 5 multiple-choice practice questions on the topic the student provides. Use markdown, show answers at the bottom under '### Answers'.",
      summarize:
        "You are a study tutor. Summarize the material the student provides into clear bullet-point notes with key concepts highlighted.",
      exam_plan:
        "You are a study coach. Build a focused day-by-day exam prep plan based on the student's topic and timeframe. Use a markdown table.",
    };

    const messages = [
      { role: "system" as const, content: systemByMode[data.mode] },
      ...(history ?? []).map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      { role: "user" as const, content: data.message },
    ];

    // Save user message
    await supabase.from("ai_messages").insert({ chat_id: chatId, role: "user", content: data.message });

    // Call Lovable AI Gateway directly (OpenAI-compatible)
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("AI is rate-limited. Try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
      throw new Error(`AI error: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const reply = json.choices?.[0]?.message?.content ?? "";

    await supabase.from("ai_messages").insert({ chat_id: chatId, role: "assistant", content: reply });

    return { chatId, reply };
  });

export const listChats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("ai_chats")
      .select("*")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const getChatMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ chatId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: msgs } = await context.supabase
      .from("ai_messages")
      .select("*")
      .eq("chat_id", data.chatId)
      .order("created_at");
    return msgs ?? [];
  });
