import type { Metadata } from "next";
import { AdminBarChart } from "@/components/admin/admin-charts";
import { SectionHeader } from "@/components/shared/section-header";
import { StatCard } from "@/components/shared/stat-card";
import { cityName, formatMoney } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatRatingServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import {
  bookingsSeries,
  completedBookingsSeries,
  platformOverview,
  ratingDistribution,
  requestsSeries,
  revenueSeries,
  topCities,
  usersSeries,
} from "@/server/analytics/service";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "admin.analytics") };
}

export default async function AdminAnalyticsPage() {
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const [overview, users, requests, bookings, completed, revenue, cities, ratings] = await Promise.all([
    platformOverview(),
    usersSeries(6),
    requestsSeries(6),
    bookingsSeries(6),
    completedBookingsSeries(6),
    revenueSeries(6),
    topCities(8),
    ratingDistribution(),
  ]);

  return (
    <div className="space-y-8">
      <SectionHeader as="h1" size="lg" title={t("admin.analytics")} />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("admin.chart.completionRate")} value={`${overview.rates.completionRate}%`} tone="success" />
        <StatCard label={t("admin.stat.gmv")} value={formatMoney(overview.money.completedVolume, { locale })} hint={formatMoney(overview.money.averageTicket, { locale })} />
        <StatCard label={t("pro.stat.acceptanceRate")} value={`${overview.rates.offerAcceptanceRate}%`} />
        <StatCard label={t("admin.stat.reviews")} value={formatRatingServer(overview.rates.averageRating, locale)} />
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">{t("admin.chart.userGrowth")}</h2>
          <AdminBarChart data={users.map((point) => ({ label: point.label, value: point.value }))} label={t("admin.users")} />
        </section>
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">{t("admin.chart.bookingsPerMonth")}</h2>
          <AdminBarChart data={bookings.map((point) => ({ label: point.label, value: point.value }))} label={t("admin.bookings")} />
        </section>
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">{t("admin.stat.completedJobs")}</h2>
          <AdminBarChart data={completed.map((point) => ({ label: point.label, value: point.value }))} label={t("admin.stat.completedJobs")} />
        </section>
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">{t("admin.stat.gmv")}</h2>
          <AdminBarChart data={revenue.map((point) => ({ label: point.label, value: point.value }))} label={t("admin.stat.gmv")} money />
        </section>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">{t("admin.chart.topCities")}</h2>
          <ul className="space-y-2 text-sm">
            {cities.map((city) => (
              <li key={city.slug} className="flex justify-between gap-3">
                <span>{cityName(city.slug, locale)}</span>
                <span className="tabular-nums text-muted-foreground">{city.requests} · {city.professionals}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">{t("admin.stat.reviews")}</h2>
          <AdminBarChart
            data={[5, 4, 3, 2, 1].map((star) => ({ label: String(star), value: ratings[star] ?? 0 }))}
            label={t("admin.stat.reviews")}
          />
          <p className="mt-2 text-xs text-muted-foreground">{t("admin.chart.requestsPerMonth")}: {requests.reduce((sum, point) => sum + point.value, 0)}</p>
        </section>
      </div>
    </div>
  );
}
