import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ConversationList, toConversationItem } from "@/components/messages/conversation-list";
import { ThreadPanel, type ThreadMessage } from "@/components/messages/thread-panel";
import { loadOrNull } from "@/lib/api/or-not-found";
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";
import { getConversation, listConversations, listMessages } from "@/server/messaging/service";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "messages.page.title") };
}

export default async function ProfessionalThreadPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login?next=/professional/messages");
  const { id } = await params;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const conversation = await loadOrNull(getConversation(session.user, id));
  if (!conversation) notFound();
  const [messages, inbox] = await Promise.all([
    listMessages({ conversationId: id, actorId: session.user.id, perPage: 80 }),
    listConversations({ actorId: session.user.id, page: 1, perPage: 30 }),
  ]);
  const other = conversation.participants.find((participant) => participant.user.id !== session.user.id)?.user;
  const title = other?.identity?.fullName || conversation.subject || t("messages.page.title");
  const context = conversation.request?.title || conversation.booking?.title || conversation.service?.title;
  const initial: ThreadMessage[] = messages.items.map((message) => ({
    id: message.id,
    body: message.body,
    senderId: message.senderId,
    senderName: message.sender.identity?.fullName || t("messages.you"),
    createdAt: message.createdAt.toISOString(),
    clientId: message.clientId,
    mine: message.senderId === session.user.id,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <div className="hidden lg:block">
        <ConversationList
          items={inbox.items.map((row) => toConversationItem(row, session.user.id))}
          activeId={id}
          locale={locale}
          basePath="/professional/messages"
        />
      </div>
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-start gap-3 border-b pb-3">
          <Link href="/professional/messages" className="mt-0.5 text-muted-foreground hover:text-foreground lg:hidden" aria-label={t("common.back")}>
            <ArrowRight className="h-4 w-4 rotate-180 flip-rtl" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">{title}</h1>
            {context && <p className="truncate text-xs text-muted-foreground">{context}</p>}
          </div>
        </div>
        <ThreadPanel conversationId={conversation.id} initial={initial} />
      </section>
    </div>
  );
}
