import Link from "next/link";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { LangCode } from "@/lib/i18n/config";
import { formatDateServer } from "@/lib/i18n/server-format";
import { cn, truncate } from "@/lib/utils";

export function toConversationItem(
  row: {
    id: string;
    subject: string | null;
    lastMessagePreview: string | null;
    lastMessageAt: Date | null;
    unreadCount?: number;
    request: { title: string } | null;
    booking: { title: string } | null;
    service: { title: string } | null;
    participants: {
      unreadCount: number;
      user: {
        id: string;
        identity: { fullName: string; avatarUrl: string | null } | null;
        professionalProfile: { businessName: string | null; avatarUrl: string | null } | null;
      };
    }[];
  },
  myId: string
): ConversationListItem {
  const other = row.participants.find((participant) => participant.user.id !== myId)?.user;
  const mine = row.participants.find((participant) => participant.user.id === myId);
  return {
    id: row.id,
    name: other?.professionalProfile?.businessName?.trim() || other?.identity?.fullName || "—",
    avatarUrl: other?.professionalProfile?.avatarUrl ?? other?.identity?.avatarUrl ?? null,
    title: row.subject || row.request?.title || row.booking?.title || row.service?.title || "—",
    preview: row.lastMessagePreview,
    unread: row.unreadCount ?? mine?.unreadCount ?? 0,
    at: row.lastMessageAt,
  };
}

export interface ConversationListItem {
  id: string;
  name: string;
  avatarUrl: string | null;
  title: string;
  preview: string | null;
  unread: number;
  at: Date | string | null;
}

export function ConversationList({
  items,
  activeId,
  locale,
  basePath = "/dashboard/messages",
}: {
  items: ConversationListItem[];
  activeId?: string;
  locale: LangCode;
  basePath?: string;
}) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <li key={item.id}>
            <Link
              href={`${basePath}/${item.id}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-start gap-3 px-3 py-3 transition-colors hover:bg-muted/60",
                active && "bg-brand-50"
              )}
            >
              <UserAvatar name={item.name} src={item.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={cn("truncate text-sm", item.unread > 0 ? "font-semibold" : "font-medium")}>{item.name}</p>
                  {item.unread > 0 && (
                    <span className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white tabular-nums">
                      {item.unread}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">{item.title}</p>
                {item.preview && <p className="truncate text-xs text-muted-foreground/80">{truncate(item.preview, 80)}</p>}
              </div>
              {item.at && (
                <time className="shrink-0 text-[10px] text-muted-foreground">
                  {formatDateServer(item.at, locale, { day: "numeric", month: "short" })}
                </time>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
