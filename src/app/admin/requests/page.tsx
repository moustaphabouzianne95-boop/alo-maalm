import type { Metadata } from "next";
import Link from "next/link";
import type { RequestStatus } from "@prisma/client";
import { UrlSearch } from "@/components/dashboard/url-search";
import { OptionSelect } from "@/components/shared/filter-controls";
import { Pagination } from "@/components/shared/pagination";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { cityName } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatDateServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { buildPageHref, spOptionalString, spPage, spString, type SearchParams } from "@/lib/utils/search-params";
import { listRequests } from "@/server/requests/service";

const STATUSES = ["OPEN", "RECEIVING_OFFERS", "OFFER_SELECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "EXPIRED"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "admin.requests") };
}

export default async function AdminRequestsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const statusRaw = spString(sp.status);
  const result = await listRequests({
    scope: "admin",
    status: (STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as RequestStatus) : undefined,
    search: spOptionalString(sp.search),
    page: spPage(sp.page),
    perPage: 15,
    sort: "newest",
  });

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" size="lg" title={t("admin.requests")} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <UrlSearch placeholder={t("common.search")} className="sm:max-w-xs sm:flex-1" />
        <div className="sm:w-56">
          <OptionSelect label={t("common.status")} param="status" allLabel={t("common.all")} options={STATUSES.map((value) => ({ value, label: t(`requests.status.${value}`) }))} />
        </div>
      </div>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {result.items.map((request) => (
          <li key={request.id}>
            <Link href={`/admin/requests/${request.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{request.title}</p>
                <p className="text-xs text-muted-foreground">
                  {request.reference} · {cityName(request.city, locale)} · {request._count.offers}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge domain="request" value={request.status} label={t(`requests.status.${request.status}`)} size="sm" />
                <time className="text-[11px] text-muted-foreground">{formatDateServer(request.createdAt, locale)}</time>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={result.perPage} locale={locale} hrefFor={(next) => buildPageHref("/admin/requests", sp, next)} />
    </div>
  );
}
