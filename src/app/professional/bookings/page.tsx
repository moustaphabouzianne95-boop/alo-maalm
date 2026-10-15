import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { UrlSearch } from "@/components/dashboard/url-search";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { getSession } from "@/lib/auth/session";
import { cityName, formatMoney } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatDateServer, formatNumberServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { buildPageHref, spEnum, spOptionalString, spPage, type SearchParams } from "@/lib/utils/search-params";
import { bookingCounts, listBookings, type BookingTab } from "@/server/bookings/service";

const TABS = ["active", "upcoming", "completed", "cancelled", "all"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "bookings.page.title") };
}

export default async function ProfessionalBookingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/professional/bookings");
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const tab = spEnum(sp.tab, TABS, "active");
  const page = spPage(sp.page);
  const [result, counts] = await Promise.all([
    listBookings({
      actorId: session.user.id,
      role: "PROFESSIONAL",
      tab,
      search: spOptionalString(sp.search),
      page,
      perPage: 10,
    }),
    bookingCounts(session.user.id, "PROFESSIONAL"),
  ]);
  const tabCount: Record<BookingTab, number> = {
    active: counts.active,
    upcoming: counts.upcoming,
    completed: counts.completed,
    cancelled: counts.cancelled,
    all: counts.total,
  };

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" size="lg" title={t("bookings.page.title")} description={t("bookings.paymentDisclaimer")} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="no-scrollbar flex gap-1 overflow-x-auto" aria-label={t("bookings.page.title")}>
          {TABS.map((value) => (
            <Link
              key={value}
              href={value === "active" ? "/professional/bookings" : `/professional/bookings?tab=${value}`}
              aria-current={tab === value ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",
                tab === value ? "bg-brand-600 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {t(`bookings.tabs.${value}`)}
              <span className="ms-1 tabular-nums opacity-80">{formatNumberServer(tabCount[value], locale)}</span>
            </Link>
          ))}
        </nav>
        <UrlSearch placeholder={t("common.search")} className="sm:w-64" />
      </div>
      {result.items.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck className="h-6 w-6" />}
          title={t("bookings.empty.professional.title")}
          description={t("bookings.empty.professional.body")}
          action={
            <Link href="/professional/requests" className="text-sm font-medium text-primary">
              {t("bookings.empty.professional.cta")}
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {result.items.map((booking) => {
            const name = booking.customer.identity?.fullName || booking.customer.identity?.firstName || t("user.role.CUSTOMER");
            return (
              <li key={booking.id}>
                <Link href={`/professional/bookings/${booking.id}`} className="card-hover block rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold">{booking.title}</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">{name}</p>
                    </div>
                    <StatusBadge domain="booking" value={booking.status} label={t(`bookings.status.${booking.status}`)} size="sm" />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {formatDateServer(booking.scheduledDate, locale)}
                      {booking.scheduledTime ? ` · ${booking.scheduledTime}` : ""}
                      {" · "}
                      {cityName(booking.city, locale)}
                    </span>
                    <span className="font-semibold text-foreground tabular-nums">{formatMoney(booking.price, { locale })}</span>
                  </div>
                </Link>
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
        hrefFor={(next) => buildPageHref("/professional/bookings", sp, next)}
      />
    </div>
  );
}
