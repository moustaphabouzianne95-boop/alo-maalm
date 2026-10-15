import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import type { OfferStatus } from "@prisma/client";
import { WithdrawOfferButton } from "@/components/professional/withdraw-offer-button";
import { EmptyState } from "@/components/shared/empty-state";
import { OptionSelect } from "@/components/shared/filter-controls";
import { Pagination } from "@/components/shared/pagination";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { getSession } from "@/lib/auth/session";
import { formatMoney } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatDateServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { buildPageHref, spPage, spString, type SearchParams } from "@/lib/utils/search-params";
import { listOffers } from "@/server/offers/service";

const STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "pro.offers.title") };
}

export default async function ProfessionalOffersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/professional/offers");
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const statusRaw = spString(sp.status);
  const result = await listOffers({
    scope: "sent",
    actorId: session.user.id,
    status: (STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as OfferStatus) : undefined,
    page: spPage(sp.page),
    perPage: 12,
  });

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" size="lg" title={t("pro.offers.title")} />
      <div className="max-w-xs">
        <OptionSelect
          label={t("common.status")}
          param="status"
          allLabel={t("common.all")}
          options={STATUSES.map((value) => ({ value, label: t(`offers.status.${value}`) }))}
        />
      </div>
      {result.items.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={t("offers.empty.professional.title")}
          description={t("offers.empty.professional.body")}
          action={
            <Link href="/professional/requests" className="text-sm font-medium text-primary">
              {t("offers.empty.professional.cta")}
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {result.items.map((offer) => (
            <li key={offer.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-semibold">{offer.request.title}</h2>
                    <StatusBadge domain="offer" value={offer.status} label={t(`offers.status.${offer.status}`)} size="sm" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {offer.request.reference} · {formatDateServer(offer.createdAt, locale)}
                  </p>
                </div>
                <p className="text-sm font-bold tabular-nums">{formatMoney(offer.price, { locale })}</p>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{offer.message}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link href={`/professional/requests/${offer.request.id}`} className="text-xs font-medium text-primary">
                  {t("common.viewDetails")}
                </Link>
                {offer.booking && (
                  <Link href={`/professional/bookings/${offer.booking.id}`} className="text-xs font-medium text-primary">
                    {t("requests.detail.booking")}
                  </Link>
                )}
                {offer.status === "PENDING" && <WithdrawOfferButton offerId={offer.id} />}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        perPage={result.perPage}
        locale={locale}
        hrefFor={(next) => buildPageHref("/professional/offers", sp, next)}
      />
    </div>
  );
}
