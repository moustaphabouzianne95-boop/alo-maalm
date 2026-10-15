import type { Metadata } from "next";
import Link from "next/link";
import { UrlSearch } from "@/components/dashboard/url-search";
import { Pagination } from "@/components/shared/pagination";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { getSession } from "@/lib/auth/session";
import { cityName, formatMoney } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatDateServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { buildPageHref, spEnum, spOptionalString, spPage, type SearchParams } from "@/lib/utils/search-params";
import { listBookings, type BookingTab } from "@/server/bookings/service";
import { cn } from "@/lib/utils";

const TABS = ["active", "upcoming", "completed", "cancelled", "all"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "admin.bookings") };
}

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const tab = spEnum(sp.tab, TABS, "all") as BookingTab;
  const result = await listBookings({
    actorId: session?.user.id ?? "",
    role: "ADMIN",
    tab,
    search: spOptionalString(sp.search),
    page: spPage(sp.page),
    perPage: 15,
  });

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" size="lg" title={t("admin.bookings")} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-1">
          {TABS.map((value) => (
            <Link
              key={value}
              href={value === "all" ? "/admin/bookings" : `/admin/bookings?tab=${value}`}
              className={cn("rounded-full px-3 py-1.5 text-xs font-medium", tab === value ? "bg-ink-900 text-white" : "bg-muted text-muted-foreground")}
            >
              {t(`bookings.tabs.${value}`)}
            </Link>
          ))}
        </nav>
        <UrlSearch placeholder={t("common.search")} className="sm:w-64" />
      </div>
      <ul className="space-y-3">
        {result.items.map((booking) => (
          <li key={booking.id}>
            <Link href={`/admin/bookings/${booking.id}`} className="block rounded-xl border bg-card p-4 shadow-sm hover:bg-muted/30">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{booking.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {booking.reference} · {cityName(booking.city, locale)} · {formatDateServer(booking.scheduledDate, locale)}
                  </p>
                </div>
                <StatusBadge domain="booking" value={booking.status} label={t(`bookings.status.${booking.status}`)} size="sm" />
              </div>
              <p className="mt-2 text-sm font-semibold tabular-nums">{formatMoney(booking.price, { locale })}</p>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={result.perPage} locale={locale} hrefFor={(next) => buildPageHref("/admin/bookings", sp, next)} />
    </div>
  );
}
