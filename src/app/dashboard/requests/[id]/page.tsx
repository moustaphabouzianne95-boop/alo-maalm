import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MapPin, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfferDecisionCard, type OfferDecisionData } from "@/components/offers/offer-decision";
import { CancelRequestButton } from "@/components/requests/cancel-request-button";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { CategoryIcon } from "@/components/icons/category-icon";
import { loadOrNull } from "@/lib/api/or-not-found";
import { getSession } from "@/lib/auth/session";
import { cityName, formatMoneyRange } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { pickLocalized } from "@/lib/i18n/localize";
import { formatDateServer, formatNumberServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { OFFERABLE_STATUSES, getRequest } from "@/server/requests/service";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const locale = await getLocale();
  const session = await getSession();
  if (!session) return { title: translate(locale, "requests.page.title") };
  try {
    const request = await getRequest(session.user, id);
    return { title: request.title };
  } catch {
    return { title: translate(locale, "requests.detail.notFound") };
  }
}

function dateInput(value: Date | null): string | null {
  if (!value) return null;
  return value.toISOString();
}

export default async function CustomerRequestDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard/requests");
  const { id } = await params;
  const locale = await getLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const request = await loadOrNull(getRequest(session.user, id));
  if (!request) notFound();

  const offerable = OFFERABLE_STATUSES.includes(request.status);
  const canEdit = offerable && request.offersCount === 0 && request.customerId === session.user.id;
  const canCancel = ["OPEN", "RECEIVING_OFFERS", "OFFER_SELECTED", "IN_PROGRESS"].includes(request.status) && request.customerId === session.user.id;
  const isOwner = request.customerId === session.user.id;

  const pending = request.offers.filter((offer) => offer.status === "PENDING");
  const bestPrice = pending.length > 1 ? Math.min(...pending.map((offer) => offer.price)) : null;
  const durations = pending.filter((offer) => offer.durationMin != null && offer.durationMin > 0);
  const fastest = durations.length > 1 ? Math.min(...durations.map((offer) => offer.durationMin as number)) : null;
  const ratings = pending.map((offer) => Number(offer.professional.professionalProfile?.ratingAverage ?? 0));
  const topRated = pending.length > 1 && Math.max(...ratings) > 0 ? Math.max(...ratings) : null;

  const daysLeft = request.expiresAt
    ? Math.ceil((request.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null;

  const cards: OfferDecisionData[] = request.offers.map((offer) => {
    const profile = offer.professional.professionalProfile;
    const rating = Number(profile?.ratingAverage ?? 0);
    const badges: OfferDecisionData["badges"] = [];
    if (offer.status === "PENDING" && bestPrice != null && offer.price === bestPrice) badges.push("bestPrice");
    if (offer.status === "PENDING" && fastest != null && offer.durationMin === fastest) badges.push("fastest");
    if (offer.status === "PENDING" && topRated != null && rating === topRated) badges.push("topRated");
    return {
      id: offer.id,
      price: offer.price,
      message: offer.message,
      notes: offer.notes,
      durationMin: offer.durationMin,
      proposedDate: dateInput(offer.proposedDate),
      proposedTime: offer.proposedTime,
      validUntil: dateInput(offer.isValidUntil),
      status: offer.status,
      professionalUserId: offer.professional.id,
      professionalName: profile?.businessName?.trim() || offer.professional.identity?.fullName || "—",
      professionalSlug: profile?.slug ?? null,
      avatarUrl: profile?.avatarUrl ?? offer.professional.identity?.avatarUrl ?? null,
      verified: profile?.verificationStatus === "VERIFIED",
      ratingAverage: rating,
      ratingCount: profile?.ratingCount ?? 0,
      completedJobs: profile?.completedJobs ?? 0,
      city: profile?.city ? cityName(profile.city, locale) : null,
      badges,
      canDecide: isOwner && offer.status === "PENDING" && offerable,
      canMessage: isOwner && offer.status !== "WITHDRAWN",
      requestId: request.id,
      bookingId: offer.booking?.id ?? null,
    };
  });

  const hasBudget = request.budgetMin != null || request.budgetMax != null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link href="/dashboard/requests" className="hover:text-foreground">
          {t("requests.page.title")}
        </Link>
        <span aria-hidden>/</span>
        <span className="tabular-nums">{request.reference}</span>
      </div>

      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: request.category.color ?? "#0f6b48" }}
              aria-hidden
            >
              <CategoryIcon name={request.category.icon} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <SectionHeader as="h1" size="md" title={request.title} className="items-start" />
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{pickLocalized(request.category, locale)}</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" aria-hidden />
                  {cityName(request.city, locale)}
                  {request.neighborhood ? ` · ${request.neighborhood}` : ""}
                </span>
                <span>{t("requests.views", { count: formatNumberServer(request.viewsCount, locale) })}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge domain="request" value={request.status} label={t(`requests.status.${request.status}`)} />
            {request.urgency !== "NORMAL" && (
              <StatusBadge domain="urgency" value={request.urgency} label={t(`requests.urgency.${request.urgency}`)} />
            )}
          </div>
        </div>

        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{request.description}</p>

        {request.address && isOwner && (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("bookings.address")}: {request.address}
          </p>
        )}

        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">{t("requests.budget")}</dt>
            <dd className="font-semibold">
              {hasBudget ? formatMoneyRange(request.budgetMin, request.budgetMax, { locale }) : t("services.pricing.CUSTOM_QUOTE")}
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
            <dt className="text-xs text-muted-foreground">{t("requests.reference")}</dt>
            <dd className="tabular-nums">
              {request.reference}
              {daysLeft != null && daysLeft > 0 && offerable && (
                <span className="mt-0.5 block text-xs text-muted-foreground">{t("requests.detail.expiresIn", { days: daysLeft })}</span>
              )}
            </dd>
          </div>
        </dl>

        {request.images.some((image) => image.url) && (
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {request.images
              .filter((image) => image.url)
              .map((image) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={image.id} src={image.url} alt="" className="h-24 w-32 rounded-lg object-cover" />
              ))}
          </div>
        )}

        {isOwner && (canEdit || canCancel || request.bookingId) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {canEdit && (
              <Button variant="outline" asChild>
                <Link href={`/dashboard/requests/${request.id}/edit`}>
                  <Pencil className="h-4 w-4" aria-hidden />
                  {t("requests.detail.edit")}
                </Link>
              </Button>
            )}
            {canCancel && <CancelRequestButton requestId={request.id} />}
            {request.bookingId && (
              <Button variant="secondary" asChild>
                <Link href={`/dashboard/bookings/${request.bookingId}`}>{t("requests.detail.booking")}</Link>
              </Button>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader
          as="h2"
          size="sm"
          title={t("requests.detail.offers")}
          description={t("requests.offersCount", { count: request.offers.length })}
        />
        {cards.length === 0 ? (
          <EmptyState compact title={t("requests.detail.noOffers")} description={t("requests.detail.noOffersBody")} />
        ) : (
          <div className="space-y-3">
            {cards.map((offer) => (
              <OfferDecisionCard key={offer.id} offer={offer} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
