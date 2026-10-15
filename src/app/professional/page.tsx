import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, CalendarCheck, FileText, Star, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvailabilityToggle } from "@/components/professional/availability-toggle";
import { RevenueChart } from "@/components/professional/performance-chart";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { loadOrNull } from "@/lib/api/or-not-found";
import { getSession } from "@/lib/auth/session";
import { formatMoney } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatDateServer, formatNumberServer, formatRatingServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { professionalMiniStats, professionalPerformance } from "@/server/analytics/service";
import { nextBooking } from "@/server/bookings/service";
import { getOwnProfessionalProfile } from "@/server/professionals/service";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "pro.title") };
}

export default async function ProfessionalHomePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/professional");
  const locale = await getLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const profile = await loadOrNull(getOwnProfessionalProfile(session.user.id));

  if (!profile) {
    return <EmptyState title={t("pro.profileIncomplete.title")} description={t("pro.profileIncomplete.body")} />;
  }

  const [performance, mini, upcoming] = await Promise.all([
    professionalPerformance(session.user.id),
    professionalMiniStats(session.user.id),
    nextBooking(session.user.id, "PROFESSIONAL"),
  ]);
  const verification = profile.verificationStatus;
  const incomplete = !profile.headline || !profile.about || profile.about.length <= 40;

  return (
    <div className="space-y-8">
      <SectionHeader
        as="h1"
        size="lg"
        title={t("pro.welcome", { name: profile.businessName || session.user.firstName })}
        description={t("pro.subtitle")}
        action={<AvailabilityToggle value={profile.availabilityStatus} />}
      />

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-brand-600" aria-hidden />
            <div>
              <p className="text-sm font-semibold">{t(`pro.verification.${verification}`)}</p>
              {verification === "PENDING" && <p className="text-xs text-muted-foreground">{t("pro.verification.PENDING.body")}</p>}
              {verification === "REJECTED" && profile.verificationNote && (
                <p className="text-xs text-destructive">{profile.verificationNote}</p>
              )}
            </div>
          </div>
          <StatusBadge domain="verification" value={verification} label={t(`verification.status.${verification}`)} />
        </div>
        {incomplete && (
          <p className="mt-3 text-sm">
            {t("pro.profileIncomplete.body")}{" "}
            <Link href="/professional/profile" className="font-medium text-primary">
              {t("professionals.profile.editProfile")}
            </Link>
          </p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("pro.stat.offersSent")} value={performance.totals.offersSent} icon={<FileText />} tone="info" href="/professional/offers" hint={t("pro.week.offers", { count: mini.newOffers })} />
        <StatCard label={t("pro.stat.bookings")} value={performance.totals.bookings} icon={<CalendarCheck />} tone="brand" href="/professional/bookings" hint={t("pro.week.bookings", { count: mini.newBookings })} />
        <StatCard label={t("pro.stat.completed")} value={performance.totals.completedJobs} icon={<Wrench />} tone="success" href="/professional/bookings?tab=completed" />
        <StatCard
          label={t("pro.stat.rating")}
          value={formatRatingServer(performance.rates.averageRating, locale)}
          icon={<Star />}
          tone="warning"
          href="/professional/reviews"
          hint={`${formatNumberServer(performance.totals.reviews, locale)} ${t("common.reviews")}`}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t("pro.stat.revenue")} value={formatMoney(performance.money.revenueCompleted, { locale })} tone="success" />
        <StatCard label={t("pro.pipeline")} value={formatMoney(performance.money.revenuePipeline, { locale })} tone="warning" />
        <StatCard label={t("pro.stat.acceptanceRate")} value={`${performance.rates.acceptanceRate}%`} hint={t("pro.stat.responseTime")} tone="info" />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-xl border bg-card p-4 shadow-sm lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold">{t("pro.chart.revenue")}</h2>
          <RevenueChart data={performance.series.revenue.map((point) => ({ label: point.label, value: point.value }))} />
          {performance.series.revenue.every((point) => point.value === 0) && (
            <p className="text-sm text-muted-foreground">{t("dashboard.noUpcomingBookings")}</p>
          )}
        </section>
        <section className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold">{t("dashboard.upcomingBookings")}</h2>
          {upcoming ? (
            <Link href={`/professional/bookings/${upcoming.id}`} className="card-hover block rounded-xl border bg-card p-4 text-sm shadow-sm">
              <p className="font-semibold">{upcoming.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDateServer(upcoming.scheduledDate, locale)}
                {upcoming.scheduledTime ? ` · ${upcoming.scheduledTime}` : ""}
              </p>
              <p className="mt-2 font-semibold tabular-nums">{formatMoney(upcoming.price, { locale })}</p>
            </Link>
          ) : (
            <EmptyState compact title={t("dashboard.noUpcomingBookings")} />
          )}
          <Button asChild variant="outline" className="w-full">
            <Link href="/professional/requests">{t("pro.requests.title")}</Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
