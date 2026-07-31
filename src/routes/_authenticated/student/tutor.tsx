import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiChat, listChats, getChatMessages } from "@/lib/ai.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, MessageSquarePlus, Send, GraduationCap, FileText, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/student/tutor")({
  component: Tutor,
});

type Mode = "chat" | "practice" | "summarize" | "exam_plan";

function Tutor() {
  const list = useServerFn(listChats);
  const getMsgs = useServerFn(getChatMessages);
  const send = useServerFn(aiChat);
  const qc = useQueryClient();

  const [chatId, setChatId] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<Mode>("chat");
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: chats } = useQuery({ queryKey: ["ai-chats"], queryFn: () => list() });
  const { data: messages = [] } = useQuery({
    queryKey: ["ai-messages", chatId],
    queryFn: () => chatId ? getMsgs({ data: { chatId } }) : Promise.resolve([]),
    enabled: !!chatId,
  });

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages]);

  const m = useMutation({
    mutationFn: (msg: string) => send({ data: { chatId, message: msg, mode } }),
    onSuccess: (r) => {
      setChatId(r.chatId);
      qc.invalidateQueries({ queryKey: ["ai-chats"] });
      qc.invalidateQueries({ queryKey: ["ai-messages", r.chatId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    m.mutate(text);
  }

  const modeButtons: { id: Mode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "chat", label: "Chat", icon: Brain },
    { id: "practice", label: "Practice questions", icon: GraduationCap },
    { id: "summarize", label: "Summarize", icon: FileText },
    { id: "exam_plan", label: "Exam plan", icon: Sparkles },
  ];

  return (
    <div className="grid h-[calc(100vh-1px)] grid-cols-1 lg:grid-cols-[280px_1fr]">
      <aside className="hidden border-r bg-card p-3 lg:flex lg:flex-col">
        <Button className="mb-3" onClick={() => { setChatId(undefined); }}><MessageSquarePlus className="mr-2 h-4 w-4" /> New chat</Button>
        <ScrollArea className="flex-1">
          {chats?.map(c => (
            <button key={c.id} onClick={() => setChatId(c.id)} className={cn("block w-full truncate rounded-md px-3 py-2 text-left text-sm hover:bg-accent", chatId === c.id && "bg-accent")}>
              {c.title}
            </button>
          ))}
        </ScrollArea>
      </aside>

      <div className="flex h-full flex-col">
        <div className="border-b p-4">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="h-6 w-6 text-primary" /> AI Study Tutor</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {modeButtons.map(b => (
              <Button key={b.id} size="sm" variant={mode === b.id ? "default" : "outline"} onClick={() => setMode(b.id)}>
                <b.icon className="mr-1 h-4 w-4" /> {b.label}
              </Button>
            ))}
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="mx-auto max-w-md py-16 text-center text-muted-foreground">
              <Brain className="mx-auto mb-4 h-12 w-12 text-primary/40" />
              <p className="text-sm">Ask anything about your studies. Try a mode above to generate practice questions, summaries, or an exam plan.</p>
            </div>
          )}
          <div className="mx-auto max-w-3xl space-y-3">
            {messages.map(msg => (
              <Card key={msg.id} className={cn(msg.role === "user" && "bg-accent")}>
                <CardContent className="p-4">
                  <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">{msg.role}</div>
                  <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                </CardContent>
              </Card>
            ))}
            {m.isPending && <p className="text-sm text-muted-foreground">Thinking…</p>}
          </div>
        </div>

        <div className="border-t p-4">
          <div className="mx-auto flex max-w-3xl gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder="Ask your study tutor…"
              rows={2}
              className="resize-none"
            />
            <Button onClick={submit} disabled={m.isPending || !input.trim()}><Send className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
