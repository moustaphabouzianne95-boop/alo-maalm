import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarCheck, FileText, Plus, ReceiptText, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RequestCard } from "@/components/requests/request-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { SectionHeader } from "@/components/shared/section-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { cityName, formatMoney } from "@/lib/constants/morocco";
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatDateServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { customerOverview } from "@/server/dashboard/service";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "dashboard.title") };
}

export default async function CustomerDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard");

  const locale = await getLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const overview = await customerOverview(session.user.id);
  const next = overview.nextBooking;
  const proName =
    next?.professional.professionalProfile?.businessName?.trim() ||
    next?.professional.identity?.fullName ||
    "";

  return (
    <div className="space-y-8">
      <SectionHeader
        as="h1"
        size="lg"
        title={t("dashboard.welcome", { name: session.user.firstName || session.user.name })}
        description={t("dashboard.subtitle")}
        action={
          <Button asChild>
            <Link href="/dashboard/requests/new">
              <Plus className="h-4 w-4" aria-hidden />
              {t("dashboard.quickActions.request")}
            </Link>
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("dashboard.stat.openRequests")}
          value={overview.stats.openRequests}
          icon={<FileText />}
          tone="info"
          href="/dashboard/requests"
        />
        <StatCard
          label={t("dashboard.stat.receivedOffers")}
          value={overview.stats.pendingOffers}
          icon={<ReceiptText />}
          tone="warning"
          href="/dashboard/offers?status=PENDING"
        />
        <StatCard
          label={t("dashboard.stat.upcomingBookings")}
          value={overview.stats.upcomingBookings}
          icon={<CalendarCheck />}
          tone="brand"
          href="/dashboard/bookings?tab=upcoming"
        />
        <StatCard
          label={t("dashboard.stat.completedServices")}
          value={overview.stats.completedServices}
          icon={<Star />}
          tone="success"
          href="/dashboard/bookings?tab=completed"
        />
      </section>

      {overview.reviewable.length > 0 && (
        <section className="rounded-xl border border-gold-200 bg-gold-50/70 p-4">
          <h2 className="text-sm font-semibold">{t("dashboard.reviewPrompt")}</h2>
          <ul className="mt-3 space-y-2">
            {overview.reviewable.slice(0, 3).map((booking) => {
              const name =
                booking.professional.professionalProfile?.businessName?.trim() ||
                booking.professional.identity?.fullName ||
                "—";
              return (
                <li key={booking.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {booking.request?.title ?? name}
                    <span className="text-muted-foreground"> · {name}</span>
                  </span>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/dashboard/reviews#booking-${booking.id}`}>{t("dashboard.writeReview")}</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="space-y-3 lg:col-span-3">
          <SectionHeader
            as="h2"
            size="sm"
            title={t("dashboard.recentRequests")}
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/requests">{t("common.viewAll")}</Link>
              </Button>
            }
          />
          {overview.recentRequests.items.length === 0 ? (
            <EmptyState
              compact
              title={t("dashboard.noRecentRequests")}
              description={t("requests.empty.customer.body")}
              action={
                <Button asChild size="sm">
                  <Link href="/dashboard/requests/new">{t("requests.empty.customer.cta")}</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {overview.recentRequests.items.map((request) => (
                <RequestCard key={request.id} request={request} locale={locale} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3 lg:col-span-2">
          <SectionHeader as="h2" size="sm" title={t("dashboard.upcomingBookings")} />
          {next ? (
            <Link href={`/dashboard/bookings/${next.id}`} className="card-hover block rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{next.title}</p>
                <StatusBadge domain="booking" value={next.status} label={t(`bookings.status.${next.status}`)} size="sm" />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t("bookings.with", { name: proName })}</p>
              <p className="mt-3 text-sm">
                {formatDateServer(next.scheduledDate, locale)}
                {next.scheduledTime ? ` · ${next.scheduledTime}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {cityName(next.city, locale)} · {formatMoney(next.price, { locale })}
              </p>
            </Link>
          ) : (
            <EmptyState compact title={t("dashboard.noUpcomingBookings")} description={t("bookings.empty.customer.body")} />
          )}

          {overview.pendingOffers.items.length > 0 && (
            <div className="space-y-2 pt-2">
              <h3 className="text-sm font-semibold">{t("dashboard.pendingOffers")}</h3>
              <ul className="space-y-2">
                {overview.pendingOffers.items.map((offer) => {
                  const name =
                    offer.professional.professionalProfile?.businessName?.trim() ||
                    offer.professional.identity?.fullName ||
                    "—";
                  return (
                    <li key={offer.id}>
                      <Link
                        href={`/dashboard/requests/${offer.request.id}`}
                        className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm hover:bg-muted/50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{offer.request.title}</span>
                          <span className="text-xs text-muted-foreground">{name}</span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">{formatMoney(offer.price, { locale })}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
