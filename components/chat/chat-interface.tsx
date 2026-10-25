"use client";

import { Bot, LoaderCircle, MessageSquareText, Plus, Send, Square, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormError } from "@/components/ui/form-error";
import { apiRequest } from "@/lib/client/api";
import { formatDate } from "@/lib/client/format";
import { cn } from "@/lib/utils";
import type { AIMode, Conversation, Message } from "@/lib/types";

export function ChatInterface({ conversations: initialConversations, activeConversation, initialMessages, hasProvider }: {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  initialMessages: Message[];
  hasProvider: boolean;
}) {
  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [conversationId, setConversationId] = useState(activeConversation?.id ?? null);
  const [messages, setMessages] = useState(initialMessages);
  const [mode, setMode] = useState<AIMode>(activeConversation?.mode ?? "auto");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const content = input.trim();
    if (!content || sending || !hasProvider) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setSending(true);
    setError(null);
    setInput("");
    const temporaryId = `temporary-${crypto.randomUUID()}`;
    const optimistic: Message = {
      id: temporaryId, conversation_id: conversationId ?? "", user_id: "", role: "user", content,
      provider: null, model: null, status: "completed", error: null, input_tokens: null, output_tokens: null, created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    try {
      const result = await apiRequest<{ conversationId: string; userMessage: Message; assistantMessage: Message }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ conversationId, message: content, mode }),
        signal: controller.signal,
      });
      if (!conversationId) {
        setConversationId(result.conversationId);
        const title = content.slice(0, 72);
        setConversations((current) => [{ id: result.conversationId, user_id: "", title, mode, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...current]);
        window.history.replaceState(null, "", `/chat?conversation=${result.conversationId}`);
      }
      setMessages((current) => [...current.filter((message) => message.id !== temporaryId), result.userMessage, result.assistantMessage]);
    } catch (caught) {
      setInput(content);
      setError(controller.signal.aborted ? "Request cancelled. The server recorded the interrupted attempt." : caught instanceof Error ? caught.message : "Message failed");
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }

  async function removeConversation(id: string) {
    if (!window.confirm("Delete this conversation and all of its messages?")) return;
    try {
      await apiRequest(`/api/chat/conversations/${id}`, { method: "DELETE" });
      setConversations((current) => current.filter((conversation) => conversation.id !== id));
      if (id === conversationId) {
        router.push("/chat");
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Conversation could not be deleted");
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="grid min-h-[620px] lg:grid-cols-[250px_1fr]">
        <aside className="border-b border-line bg-surface-soft/50 p-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Conversations</h2><Link href="/chat" aria-label="New conversation" className="rounded-lg p-1.5 text-brand hover:bg-brand-soft"><Plus className="size-4" /></Link></div>
          <div className="mt-4 flex gap-2 overflow-x-auto lg:block lg:space-y-1">
            {conversations.map((conversation) => <div key={conversation.id} className={cn("group flex min-w-[180px] items-center rounded-xl lg:min-w-0", conversation.id === conversationId ? "bg-surface shadow-sm" : "hover:bg-surface/70")}>
              <Link href={`/chat?conversation=${conversation.id}`} className="min-w-0 flex-1 px-3 py-2.5"><p className="truncate text-xs font-medium text-ink">{conversation.title}</p><p className="mt-0.5 text-[10px] text-subtle">{formatDate(conversation.updated_at)}</p></Link>
              <button type="button" onClick={() => removeConversation(conversation.id)} aria-label={`Delete ${conversation.title}`} className="mr-1 rounded p-1.5 text-subtle opacity-100 hover:bg-warning-soft hover:text-warning lg:opacity-0 lg:group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
            </div>)}
            {!conversations.length ? <p className="px-2 py-4 text-xs leading-5 text-subtle">Your saved conversations will appear here.</p> : null}
          </div>
        </aside>

        <section className="flex min-w-0 flex-col" aria-label="AI conversation">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <div><h2 className="text-sm font-semibold">{activeConversation?.title ?? "New conversation"}</h2><p className="mt-0.5 text-[11px] text-subtle">{hasProvider ? "Verified provider available" : "No verified AI provider"}</p></div>
            <div className="flex items-center gap-2"><label htmlFor="chat-mode" className="sr-only">Chat mode</label><select id="chat-mode" value={mode} disabled={sending} onChange={(e) => setMode(e.target.value as AIMode)} className="rounded-lg border border-line bg-surface px-2.5 py-2 text-xs text-muted"><option value="auto">Auto</option><option value="deep">Deep thinking</option><option value="coding">Coding</option><option value="max">MAX</option><option value="student">Student</option></select></div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
            {!messages.length ? <EmptyState icon={MessageSquareText} title={hasProvider ? "Start a real conversation" : "Connect an AI provider first"} description={hasProvider ? "Your message and the responding model identity will be saved to this conversation." : "Auto will not simulate an answer. Add and verify an official provider in Connections."} className="py-12">{!hasProvider ? <Link href="/connections" className="rounded-xl bg-brand-strong px-4 py-2.5 text-sm font-medium text-white">Open Connections</Link> : null}</EmptyState> : messages.map((message) => <article key={message.id} className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}>
              {message.role === "assistant" ? <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong"><Bot className="size-4" /></div> : null}
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-3", message.role === "user" ? "bg-brand-strong text-white" : "border border-line bg-surface-soft/55 text-ink")}>
                {message.status === "failed" ? <p className="text-xs text-warning">{message.error ?? "This attempt failed."}</p> : <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>}
                {message.role === "assistant" ? <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line/60 pt-2 text-[10px] text-subtle">{message.provider ? <Badge variant="brand">{message.provider}</Badge> : null}{message.model ? <span>{message.model}</span> : null}{message.input_tokens !== null ? <span>{message.input_tokens} in / {message.output_tokens ?? "—"} out</span> : null}</div> : null}
              </div>
              {message.role === "user" ? <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-surface-soft text-muted"><UserRound className="size-4" /></div> : null}
            </article>)}
            {sending ? <div className="flex items-center gap-2 text-xs text-muted"><LoaderCircle className="size-4 animate-spin text-brand" />Waiting for the provider…</div> : null}
          </div>

          <div className="border-t border-line bg-surface-soft/30 p-4">
            <FormError message={error} />
            <form onSubmit={sendMessage} className="mt-2 rounded-2xl border border-line bg-surface p-3">
              <label htmlFor="chat-message" className="sr-only">Message Auto</label><textarea id="chat-message" rows={3} maxLength={24000} value={input} disabled={!hasProvider || sending} onChange={(e) => setInput(e.target.value)} placeholder={hasProvider ? "Message Auto…" : "Connect and verify a provider to enable chat"} className="block w-full resize-none bg-transparent px-1 text-sm text-ink outline-none placeholder:text-subtle" />
              <div className="mt-2 flex items-center justify-between border-t border-line pt-3"><span className="text-[10px] text-subtle">Server-side routing · official APIs only</span>{sending ? <button type="button" onClick={() => abortRef.current?.abort()} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-warning"><Square className="size-3.5" />Cancel</button> : <button type="submit" disabled={!hasProvider || !input.trim()} aria-label="Send message" className="grid size-9 place-items-center rounded-xl bg-brand-strong text-white disabled:opacity-40"><Send className="size-4" /></button>}</div>
            </form>
          </div>
        </section>
      </div>
    </Card>
  );
}
