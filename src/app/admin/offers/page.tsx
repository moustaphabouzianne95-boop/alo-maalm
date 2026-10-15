import type { Metadata } from "next";
import type { OfferStatus } from "@prisma/client";
import Link from "next/link";
import { UrlSearch } from "@/components/dashboard/url-search";
import { Pagination } from "@/components/shared/pagination";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatDateServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { buildPageHref, spOptionalString, spPage, spString, type SearchParams } from "@/lib/utils/search-params";
import { listAdminOffers } from "@/server/admin/lists";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "admin.offers") };
}

export default async function AdminOffersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const statusRaw = spString(sp.status);
  const statuses = ["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"] as const;
  const result = await listAdminOffers({
    status: (statuses as readonly string[]).includes(statusRaw) ? (statusRaw as OfferStatus) : undefined,
    search: spOptionalString(sp.search),
    page: spPage(sp.page),
    perPage: 15,
  });

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" size="lg" title={t("admin.offers")} />
      <UrlSearch placeholder={t("common.search")} className="sm:max-w-xs" />
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {result.items.map((offer) => (
          <li key={offer.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="min-w-0">
              <Link href={`/admin/requests/${offer.request.id}`} className="font-medium hover:text-primary">
                {offer.request.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                {offer.professional.professionalProfile?.businessName || offer.professional.identity?.fullName} · {formatDateServer(offer.createdAt, locale)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tabular-nums">{formatMoney(offer.price, { locale })}</span>
              <StatusBadge domain="offer" value={offer.status} label={t(`offers.status.${offer.status}`)} size="sm" />
            </div>
          </li>
        ))}
      </ul>
      <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={result.perPage} locale={locale} hrefFor={(next) => buildPageHref("/admin/offers", sp, next)} />
    </div>
  );
}
