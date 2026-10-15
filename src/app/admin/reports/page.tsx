import type { Metadata } from "next";
import Link from "next/link";
import type { ReportStatus } from "@prisma/client";
import { UrlSearch } from "@/components/dashboard/url-search";
import { OptionSelect } from "@/components/shared/filter-controls";
import { Pagination } from "@/components/shared/pagination";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatDateServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { buildPageHref, spOptionalString, spPage, spString, type SearchParams } from "@/lib/utils/search-params";
import { listReports } from "@/server/reports/service";

const STATUSES = ["OPEN", "INVESTIGATING", "RESOLVED", "DISMISSED"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "admin.reports") };
}

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const statusRaw = spString(sp.status);
  const result = await listReports({
    scope: "admin",
    status: (STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as ReportStatus) : undefined,
    search: spOptionalString(sp.search),
    page: spPage(sp.page),
    perPage: 15,
  });

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" size="lg" title={t("admin.reports")} description={result.counts.OPEN ? String(result.counts.OPEN) : undefined} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <UrlSearch placeholder={t("common.search")} className="sm:max-w-xs sm:flex-1" />
        <div className="sm:w-52">
          <OptionSelect label={t("common.status")} param="status" allLabel={t("common.all")} options={STATUSES.map((value) => ({ value, label: t(`reports.status.${value}`) }))} />
        </div>
      </div>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {result.items.length === 0 && <li className="px-4 py-8 text-sm text-muted-foreground">{t("admin.empty.generic")}</li>}
        {result.items.map((report) => (
          <li key={report.id}>
            <Link href={`/admin/reports/${report.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {report.reference} · {t(`reports.reason.${report.reason}`)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(`reports.target.${report.targetType}`)} · {report.subject?.identity?.fullName || report.reporter.identity?.fullName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge domain="report" value={report.status} label={t(`reports.status.${report.status}`)} size="sm" />
                <time className="text-[11px] text-muted-foreground">{formatDateServer(report.createdAt, locale)}</time>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={result.perPage} locale={locale} hrefFor={(next) => buildPageHref("/admin/reports", sp, next)} />
    </div>
  );
}
