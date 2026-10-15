import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { MarkAllReadButton, NotificationLink } from "@/components/notifications/notification-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { SectionHeader } from "@/components/shared/section-header";
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatDateServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { notificationLink, type NotificationType } from "@/lib/notifications/types";
import type { NotificationPayload } from "@/lib/notifications/types";
import { buildPageHref, spBool, spPage, type SearchParams } from "@/lib/utils/search-params";
import { listNotifications } from "@/server/notifications/service";
import { cn } from "@/lib/utils";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "notifications.page.title") };
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard/notifications");
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const unreadOnly = spBool(sp.unread);
  const page = spPage(sp.page);
  const result = await listNotifications({
    userId: session.user.id,
    unreadOnly,
    page,
    perPage: 20,
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        size="lg"
        title={t("notifications.page.title")}
        description={result.unreadTotal > 0 ? t("notifications.unreadCount", { count: result.unreadTotal }) : t("notifications.allRead")}
        action={<MarkAllReadButton disabled={result.unreadTotal === 0} />}
      />

      <nav className="flex gap-1" aria-label={t("notifications.page.title")}>
        <Link
          href="/dashboard/notifications"
          aria-current={!unreadOnly ? "page" : undefined}
          className={cn("rounded-full px-3 py-1.5 text-xs font-medium", !unreadOnly ? "bg-brand-600 text-white" : "bg-muted text-muted-foreground")}
        >
          {t("notifications.tabs.all")}
        </Link>
        <Link
          href="/dashboard/notifications?unread=1"
          aria-current={unreadOnly ? "page" : undefined}
          className={cn("rounded-full px-3 py-1.5 text-xs font-medium", unreadOnly ? "bg-brand-600 text-white" : "bg-muted text-muted-foreground")}
        >
          {t("notifications.tabs.unread")}
        </Link>
      </nav>

      {result.items.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title={t("notifications.empty.title")} description={t("notifications.empty.body")} />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {result.items.map((item) => {
            const type = item.type as NotificationType;
            const href = item.linkTo || notificationLink(type, (item.data ?? {}) as NotificationPayload, "CUSTOMER");
            const typeKey = `notifications.type.${item.type}`;
            const typeLabel = t(typeKey) === typeKey ? item.type : t(typeKey);
            return (
              <li key={item.id} className={cn(!item.isRead && "bg-brand-50/50")}>
                <NotificationLink id={item.id} href={href} unread={!item.isRead} className="px-4 py-3 hover:bg-muted/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-brand-700">{typeLabel}</p>
                      <p className={cn("text-sm", !item.isRead && "font-semibold")}>{item.title}</p>
                      {item.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>}
                    </div>
                    <time className="shrink-0 text-[11px] text-muted-foreground">{formatDateServer(item.createdAt, locale)}</time>
                  </div>
                </NotificationLink>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        perPage={result.perPage}
        locale={locale}
        hrefFor={(next) => buildPageHref("/dashboard/notifications", sp, next)}
      />
    </div>
  );
}
