import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiChat, listChats, getChatMessages } from "@/lib/ai.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, MessageSquarePlus, Send, GraduationCap, FileText, Sparkles, Paperclip, X } from "lucide-react";
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
  const [attachment, setAttachment] = useState<{ name: string; mimeType: string; dataUrl: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: chats } = useQuery({ queryKey: ["ai-chats"], queryFn: () => list() });
  const { data: messages = [] } = useQuery({
    queryKey: ["ai-messages", chatId],
    queryFn: () => chatId ? getMsgs({ data: { chatId } }) : Promise.resolve([]),
    enabled: !!chatId,
  });

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages]);

  async function pickFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 10MB.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsDataURL(file);
    });
    setAttachment({ name: file.name, mimeType: file.type || "application/octet-stream", dataUrl });
  }

  const m = useMutation({
    mutationFn: (payload: { msg: string; attachment: typeof attachment }) =>
      send({ data: { chatId, message: payload.msg, mode, attachment: payload.attachment ?? undefined } }),
    onSuccess: (r) => {
      setChatId(r.chatId);
      qc.invalidateQueries({ queryKey: ["ai-chats"] });
      qc.invalidateQueries({ queryKey: ["ai-messages", r.chatId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit() {
    const text = input.trim() || (attachment ? `Please analyse my document "${attachment.name}".` : "");
    if (!text) return;
    const file = attachment;
    setInput("");
    setAttachment(null);
    if (fileRef.current) fileRef.current.value = "";
    m.mutate({ msg: text, attachment: file });
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

      <div className="flex h-full flex-col overflow-hidden">
        <div className="shrink-0 border-b p-4">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="h-6 w-6 text-primary" /> AI Study Tutor</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {modeButtons.map(b => (
              <Button key={b.id} size="sm" variant={mode === b.id ? "default" : "outline"} onClick={() => setMode(b.id)}>
                <b.icon className="mr-1 h-4 w-4" /> {b.label}
              </Button>
            ))}
          </div>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="mx-auto max-w-md py-16 text-center text-muted-foreground">
              <Brain className="mx-auto mb-4 h-12 w-12 text-primary/40" />
              <p className="text-sm">Ask anything about your registered qualification. Try a mode above, or attach a document and I'll summarise it and build exam questions from it.</p>
              <p className="mt-2 text-xs">The tutor only answers questions within the modules you're enrolled in.</p>
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

        <div className="shrink-0 border-t p-4">
          <div className="mx-auto max-w-3xl">
            {attachment && (
              <div className="mb-2 flex items-center gap-2 rounded-md border bg-accent/50 px-3 py-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="truncate">{attachment.name}</span>
                <Button size="icon" variant="ghost" className="ml-auto h-6 w-6" onClick={() => { setAttachment(null); if (fileRef.current) fileRef.current.value = ""; }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.txt,.md,.csv,.doc,.docx,image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickFile(f); }}
            />
            <Button variant="outline" size="icon" onClick={() => fileRef.current?.click()} title="Attach a document">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder={attachment ? "Add instructions (optional)…" : "Ask your study tutor…"}
              rows={2}
              className="resize-none"
            />
            <Button onClick={submit} disabled={m.isPending || (!input.trim() && !attachment)}><Send className="h-4 w-4" /></Button>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
