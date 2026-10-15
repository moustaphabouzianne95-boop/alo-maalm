import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ReceiptText } from "lucide-react";
import type { OfferStatus } from "@prisma/client";
import { UrlSearch } from "@/components/dashboard/url-search";
import { EmptyState } from "@/components/shared/empty-state";
import { OptionSelect } from "@/components/shared/filter-controls";
import { Pagination } from "@/components/shared/pagination";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { getSession } from "@/lib/auth/session";
import { formatMoney } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatDateServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { buildPageHref, spOptionalString, spPage, spString, type SearchParams } from "@/lib/utils/search-params";
import { listOffers } from "@/server/offers/service";

const STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "offers.page.title") };
}

export default async function CustomerOffersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard/offers");
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const statusRaw = spString(sp.status);
  const status = (STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as OfferStatus) : undefined;
  const page = spPage(sp.page);

  const result = await listOffers({
    actorId: session.user.id,
    scope: "received",
    status,
    search: spOptionalString(sp.search),
    page,
    perPage: 10,
  });

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" size="lg" title={t("offers.page.title")} description={t("dashboard.pendingOffers")} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <UrlSearch placeholder={t("common.search")} className="sm:max-w-xs sm:flex-1" />
        <div className="sm:w-52">
          <OptionSelect
            label={t("common.status")}
            param="status"
            allLabel={t("common.all")}
            options={STATUSES.map((value) => ({ value, label: t(`offers.status.${value}`) }))}
          />
        </div>
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="h-6 w-6" />}
          title={t("offers.empty.customer.title")}
          description={t("offers.empty.customer.body")}
        />
      ) : (
        <ul className="space-y-3">
          {result.items.map((offer) => {
            const name =
              offer.professional.professionalProfile?.businessName?.trim() ||
              offer.professional.identity?.fullName ||
              "—";
            const avatar = offer.professional.professionalProfile?.avatarUrl ?? offer.professional.identity?.avatarUrl;
            return (
              <li key={offer.id}>
                <Link
                  href={`/dashboard/requests/${offer.request.id}`}
                  className="card-hover flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm"
                >
                  <UserAvatar name={name} src={avatar} size="md" rounded="xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold">{offer.request.title}</h2>
                      <StatusBadge domain="offer" value={offer.status} label={t(`offers.status.${offer.status}`)} size="sm" />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t("offers.from", { name })}</p>
                    <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{offer.message}</p>
                  </div>
                  <div className="text-end">
                    <p className="font-bold tabular-nums">{formatMoney(offer.price, { locale })}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatDateServer(offer.createdAt, locale)}</p>
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
        hrefFor={(next) => buildPageHref("/dashboard/offers", sp, next)}
      />
    </div>
  );
}
