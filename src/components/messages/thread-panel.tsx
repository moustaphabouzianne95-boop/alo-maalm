"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { mutationMessage } from "@/components/dashboard/mutation-message";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export interface ThreadMessage {
  id: string;
  body: string;
  senderId: string;
  senderName: string;
  createdAt: string;
  clientId: string | null;
  mine: boolean;
  pending?: boolean;
}



/**
 * Conversation thread with optimistic send (§17).
 * The server message, matched by `clientId`, replaces the optimistic bubble
 * on the next refresh — a retry cannot duplicate it.
 */
export function ThreadPanel({
  conversationId,
  initial,
}: {
  conversationId: string;
  initial: ThreadMessage[];
}) {
  const { t, formatDateTime } = useI18n();
  const router = useRouter();
  const [draft, setDraft] = React.useState("");
  const [pending, setPending] = React.useState<ThreadMessage[]>([]);
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    void api.post(`/api/messages/${conversationId}/read`).then(() => router.refresh()).catch(() => undefined);
    // Mark-read once per open. A failed call just leaves the badge until the next visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 20000);
    return () => window.clearInterval(id);
  }, [router]);

  const serverClientIds = new Set(initial.map((message) => message.clientId).filter(Boolean));
  const visiblePending = pending.filter(
    (message) => !initial.some((item) => item.id === message.id) && !serverClientIds.has(message.clientId)
  );
  const messages = [...initial, ...visiblePending];

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    const clientId = crypto.randomUUID();
    const optimistic: ThreadMessage = {
      id: clientId,
      clientId,
      body,
      senderId: "me",
      senderName: t("messages.you"),
      createdAt: new Date().toISOString(),
      mine: true,
      pending: true,
    };
    setPending((current) => [...current, optimistic]);
    setDraft("");
    setSending(true);
    try {
      await api.post(`/api/messages/${conversationId}`, { body, clientId });
      router.refresh();
    } catch (error) {
      setPending((current) => current.filter((message) => message.clientId !== clientId));
      setDraft(body);
      toast.error(mutationMessage(error, t, { UNPROCESSABLE_ENTITY: "messages.error.empty" }));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[min(70dvh,640px)] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-1 py-2">
        {messages.length === 0 && (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">{t("messages.empty.thread.body")}</p>
        )}
        {messages.map((message) => (
          <div key={message.id} className={cn("flex", message.mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                message.mine ? "bg-brand-600 text-white" : "bg-muted text-foreground",
                message.pending && "opacity-70"
              )}
            >
              {!message.mine && <p className="mb-0.5 text-[11px] font-semibold opacity-70">{message.senderName}</p>}
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
              <p className={cn("mt-1 text-[10px]", message.mine ? "text-white/75" : "text-muted-foreground")}>
                {formatDateTime(message.createdAt)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form
        className="flex items-end gap-2 border-t pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("messages.input.placeholder")}
          rows={2}
          maxLength={4000}
          className="min-h-[44px] flex-1"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <Button type="submit" size="icon" disabled={sending || !draft.trim()} aria-label={t("messages.send")}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 flip-rtl" />}
        </Button>
      </form>
    </div>
  );
}
