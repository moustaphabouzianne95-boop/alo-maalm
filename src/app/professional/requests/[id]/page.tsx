import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MapPin } from "lucide-react";
import { OfferForm } from "@/components/professional/offer-form";
import { WithdrawOfferButton } from "@/components/professional/withdraw-offer-button";
import { CategoryIcon } from "@/components/icons/category-icon";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { loadOrNull } from "@/lib/api/or-not-found";
import { getSession } from "@/lib/auth/session";
import { cityName, formatMoney, formatMoneyRange } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { pickLocalized } from "@/lib/i18n/localize";
import { formatDateServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { listOffersForRequest } from "@/server/offers/service";
import { OFFERABLE_STATUSES, getRequest } from "@/server/requests/service";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await getLocale();
  const session = await getSession();
  const { id } = await params;
  if (!session) return { title: translate(locale, "pro.requests.title") };
  const request = await loadOrNull(getRequest(session.user, id));
  return { title: request?.title ?? translate(locale, "requests.detail.notFound") };
}

export default async function ProfessionalRequestPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login?next=/professional/requests");
  const { id } = await params;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const request = await loadOrNull(getRequest(session.user, id));
  if (!request) notFound();
  // Competing quotes stay on the server and are never rendered for a professional.
  const mine = (await listOffersForRequest(session.user, id)).items;
  const canOffer = OFFERABLE_STATUSES.includes(request.status) && mine.length === 0 && request.customerId !== session.user.id;
  const showAddress = mine.some((offer) => offer.status === "ACCEPTED");
  const customerName = request.customer.identity?.firstName || t("user.role.CUSTOMER");

  return (
    <div className="space-y-6">
      <div className="text-xs text-muted-foreground">
        <Link href="/professional/requests" className="hover:text-foreground">
          {t("pro.requests.title")}
        </Link>
        <span aria-hidden> / </span>
        <span className="tabular-nums">{request.reference}</span>
      </div>
      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: request.category.color ?? "#0f6b48" }}>
            <CategoryIcon name={request.category.icon} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <SectionHeader as="h1" size="md" title={request.title} />
            <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>{pickLocalized(request.category, locale)}</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden />
                {cityName(request.city, locale)}
                {request.neighborhood ? ` · ${request.neighborhood}` : ""}
              </span>
              <span>{customerName}</span>
            </p>
          </div>
          <StatusBadge domain="request" value={request.status} label={t(`requests.status.${request.status}`)} />
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{request.description}</p>
        {showAddress && request.address && (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("bookings.address")}: {request.address}
          </p>
        )}
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">{t("requests.budget")}</dt>
            <dd className="font-semibold">
              {request.budgetMin != null || request.budgetMax != null
                ? formatMoneyRange(request.budgetMin, request.budgetMax, { locale })
                : t("services.pricing.CUSTOM_QUOTE")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("requests.form.preferredDate")}</dt>
            <dd>
              {request.preferredDate ? formatDateServer(request.preferredDate, locale) : "—"}
              {request.preferredTime ? ` · ${request.preferredTime}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("requests.form.urgency")}</dt>
            <dd>{t(`requests.urgency.${request.urgency}`)}</dd>
          </div>
        </dl>
      </section>

      {mine.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{t("pro.offers.title")}</h2>
          {mine.map((offer) => (
            <article key={offer.id} className="rounded-xl border bg-card p-4 text-sm shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <StatusBadge domain="offer" value={offer.status} label={t(`offers.status.${offer.status}`)} size="sm" />
                <span className="font-bold tabular-nums">{formatMoney(offer.price, { locale })}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap">{offer.message}</p>
              {offer.status === "PENDING" && (
                <div className="mt-3">
                  <WithdrawOfferButton offerId={offer.id} />
                </div>
              )}
              {offer.booking && (
                <Link href={`/professional/bookings/${offer.booking.id}`} className="mt-3 inline-block text-xs font-medium text-primary">
                  {t("requests.detail.booking")}
                </Link>
              )}
            </article>
          ))}
        </section>
      )}

      {canOffer && (
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="mb-1 text-base font-semibold">{t("offers.form.title")}</h2>
          <p className="mb-4 text-xs text-muted-foreground">{t("offers.form.subtitle")}</p>
          <OfferForm requestId={request.id} defaultPrice={request.budgetMax ?? request.budgetMin} />
        </section>
      )}
      {!canOffer && mine.length === 0 && <p className="text-sm text-muted-foreground">{t("requests.browse.closed")}</p>}
    </div>
  );
}
