import type { Metadata } from "next";
import Link from "next/link";
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
import { notificationLink, type NotificationPayload, type NotificationType } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";
import { buildPageHref, spPage, type SearchParams } from "@/lib/utils/search-params";
import { listNotifications } from "@/server/notifications/service";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "notifications.page.title") };
}

export default async function AdminNotificationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/notifications");
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const result = await listNotifications({ userId: session.user.id, page: spPage(sp.page), perPage: 20 });

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" size="lg" title={t("notifications.page.title")} action={<MarkAllReadButton disabled={result.unreadTotal === 0} />} />
      {result.items.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title={t("notifications.empty.title")} description={t("notifications.empty.body")} />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {result.items.map((item) => {
            const href = item.linkTo || notificationLink(item.type as NotificationType, (item.data ?? {}) as NotificationPayload, "ADMIN");
            return (
              <li key={item.id} className={cn(!item.isRead && "bg-amber-50/60")}>
                <NotificationLink id={item.id} href={href} unread={!item.isRead} className="px-4 py-3">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.body && <p className="text-xs text-muted-foreground">{item.body}</p>}
                  <time className="text-[11px] text-muted-foreground">{formatDateServer(item.createdAt, locale)}</time>
                </NotificationLink>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={result.perPage} locale={locale} hrefFor={(next) => buildPageHref("/admin/notifications", sp, next)} />
      <p className="text-xs text-muted-foreground">
        <Link href="/admin/reports">{t("admin.reports")}</Link>
      </p>
    </div>
  );
}
