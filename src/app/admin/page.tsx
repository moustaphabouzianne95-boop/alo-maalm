import type { Metadata } from "next";
import Link from "next/link";
import { Flag, ShieldCheck, Users, Wallet } from "lucide-react";
import { AdminBarChart } from "@/components/admin/admin-charts";
import { SectionHeader } from "@/components/shared/section-header";
import { StatCard } from "@/components/shared/stat-card";
import { formatMoney } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatNumberServer, formatRatingServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { bookingsSeries, platformOverview, popularCategories, requestsSeries, revenueSeries, usersSeries } from "@/server/analytics/service";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "admin.overview") };
}

export default async function AdminHomePage() {
  const locale = await getLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const [overview, categories, users, requests, bookings, revenue] = await Promise.all([
    platformOverview(),
    popularCategories(6),
    usersSeries(6),
    requestsSeries(6),
    bookingsSeries(6),
    revenueSeries(6),
  ]);

  return (
    <div className="space-y-8">
      <SectionHeader as="h1" size="lg" title={t("admin.overview")} description={t("admin.title")} />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("admin.stat.totalUsers")} value={formatNumberServer(overview.totals.users, locale)} icon={<Users />} hint={`+${overview.deltas.usersThisMonth}`} href="/admin/users" />
        <StatCard label={t("admin.stat.pendingVerification")} value={overview.totals.pendingVerification} icon={<ShieldCheck />} tone="warning" href="/admin/professionals?verification=PENDING" />
        <StatCard label={t("admin.stat.openReports")} value={overview.totals.reportsOpen} icon={<Flag />} tone="danger" href="/admin/reports" />
        <StatCard label={t("admin.stat.gmv")} value={formatMoney(overview.money.completedVolume, { locale })} icon={<Wallet />} tone="success" href="/admin/analytics" hint={t("admin.chart.completionRate") + ` ${overview.rates.completionRate}%`} />
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("admin.stat.professionals")} value={overview.totals.professionals} href="/admin/professionals" hint={`${overview.rates.verifiedShare}%`} />
        <StatCard label={t("admin.stat.customers")} value={overview.totals.customers} href="/admin/users?role=CUSTOMER" />
        <StatCard label={t("admin.stat.activeRequests")} value={overview.totals.activeRequests} href="/admin/requests" hint={`+${overview.deltas.requestsThisMonth}`} />
        <StatCard label={t("admin.stat.reviews")} value={overview.totals.reviews} href="/admin/reviews" hint={formatRatingServer(overview.rates.averageRating, locale)} />
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">{t("admin.chart.userGrowth")}</h2>
          <AdminBarChart data={users.map((point) => ({ label: point.label, value: point.value }))} label={t("admin.chart.userGrowth")} />
        </section>
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">{t("admin.chart.requestsPerMonth")}</h2>
          <AdminBarChart data={requests.map((point) => ({ label: point.label, value: point.value }))} label={t("admin.chart.requestsPerMonth")} />
        </section>
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">{t("admin.chart.bookingsPerMonth")}</h2>
          <AdminBarChart data={bookings.map((point) => ({ label: point.label, value: point.value }))} label={t("admin.chart.bookingsPerMonth")} />
        </section>
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">{t("admin.stat.gmv")}</h2>
          <AdminBarChart data={revenue.map((point) => ({ label: point.label, value: point.value }))} label={t("admin.stat.gmv")} money />
        </section>
      </div>
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">{t("admin.chart.popularCategories")}</h2>
        <ul className="divide-y text-sm">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center justify-between py-2">
              <Link href={`/admin/services?category=${category.slug}`} className="font-medium hover:text-primary">
                {category.name}
              </Link>
              <span className="text-xs text-muted-foreground tabular-nums">
                {category.requests} · {category.services}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
