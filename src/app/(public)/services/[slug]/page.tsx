import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Clock,
  Flame,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CategoryIcon } from "@/components/icons/category-icon";
import { FavoriteButton } from "@/components/shared/favorite-button";
import { RatingStars } from "@/components/shared/rating-stars";
import { ServiceCard, servicePriceLabel } from "@/components/services/service-card";
import { getSession } from "@/lib/auth/session";
import { cityName, formatMoney } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { pickLocalized, pickLocalizedDescription } from "@/lib/i18n/localize";
import {
  formatDateServer,
  formatDurationServer,
  formatNumberServer,
  formatRatingServer,
  formatResponseTimeServer,
} from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { initialsOf, truncate } from "@/lib/utils";
import { favoriteIdsFor } from "@/server/favorites/service";
import { listReviews } from "@/server/reviews/service";
import {
  getServicePublic,
  incrementServiceView,
  similarServices,
} from "@/server/services/service";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  try {
    const service = await getServicePublic(slug);
    return {
      title: pickLocalized(service, locale, "title"),
      description: truncate(pickLocalizedDescription(service, locale), 160),
      alternates: { canonical: `/services/${service.slug}` },
    };
  } catch {
    return { title: translate(locale, "services.page.title") };
  }
}

/**
 * Public service page (§8).
 *
 * The price and the professional's identity are rendered from the server
 * projection; contact details stay hidden unless the professional explicitly
 * published a phone number.
 */
export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const locale = await getLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);

  let service: Awaited<ReturnType<typeof getServicePublic>>;
  try {
    service = await getServicePublic(slug);
  } catch {
    notFound();
  }

  // Count the view without ever failing the render.
  void incrementServiceView(service.id).catch(() => undefined);

  const session = await getSession();
  const user = session?.user ?? null;

  const [similar, reviewsResult, favoriteIds] = await Promise.all([
    similarServices(service, 4),
    listReviews({ serviceId: service.id, perPage: 5 }),
    favoriteIdsFor(user?.id, "SERVICE", [service.id]),
  ]);

  const professional = service.professional;
  const professionalName =
    professional.businessName?.trim() || professional.user.identity?.fullName?.trim() || "—";
  const isVerified = professional.verificationStatus === "VERIFIED";
  const title = pickLocalized(service, locale, "title");
  const description = pickLocalizedDescription(service, locale);
  const categoryName = pickLocalized(service.category, locale);
  const tint = service.category.color ?? "#0f6b48";
  const isOwner = Boolean(user?.professional && user.professional.id === professional.id);
  const cover = service.images[0]?.url ?? null;

  const requestQuoteHref = !user
    ? "/register?role=CUSTOMER"
    : user.role === "CUSTOMER"
      ? `/dashboard/requests/new?serviceId=${service.id}`
      : null;
  const messageHref = !user
    ? `/login?next=${encodeURIComponent(`/services/${service.slug}`)}`
    : user.role === "CUSTOMER"
      ? `/dashboard/messages?professional=${professional.id}`
      : null;

  return (
    <div className="page-shell py-6 sm:py-8">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-primary">{t("nav.home")}</Link>
        <span aria-hidden>/</span>
        <Link href="/services" className="hover:text-primary">{t("nav.services")}</Link>
        <span aria-hidden>/</span>
        <Link href={`/categories/${service.category.slug}`} className="hover:text-primary">
          {categoryName}
        </Link>
      </nav>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <div>
          {/* Cover */}
          <div
            className="flex h-52 w-full items-center justify-center overflow-hidden rounded-2xl border sm:h-64"
            style={cover ? undefined : { background: `linear-gradient(135deg, ${tint}26, ${tint}0d)` }}
          >
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element -- served from our own storage route
              <img src={cover} alt={service.images[0]?.alt ?? title} className="h-full w-full object-cover" />
            ) : (
              <CategoryIcon name={service.category.icon} className="h-16 w-16 opacity-80" />
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link
              href={`/categories/${service.category.slug}`}
              className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs font-medium shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
            >
              <CategoryIcon name={service.category.icon} className="h-3.5 w-3.5" />
              {categoryName}
            </Link>
            {service.isUrgentAvailable ? (
              <Badge variant="warning" className="gap-1">
                <Flame className="h-3 w-3" aria-hidden />
                {t("services.filters.urgent")}
              </Badge>
            ) : null}
            <Badge variant={service.warrantyDays > 0 ? "success" : "muted"} className="gap-1">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              {service.warrantyDays > 0
                ? t("services.detail.warranty", { days: formatNumberServer(service.warrantyDays, locale) })
                : t("services.detail.noWarranty")}
            </Badge>
          </div>

          <h1 className="mt-3 text-2xl font-extrabold leading-snug tracking-tight text-balance sm:text-3xl">
            {title}
          </h1>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {cityName(service.city, locale)}
              {service.neighborhood ? ` · ${service.neighborhood}` : ""}
            </span>
            {service.ratingCount > 0 ? (
              <a href="#reviews" className="flex items-center gap-1.5 hover:text-foreground">
                <RatingStars value={Number(service.ratingAverage)} size={13} />
                <span dir="ltr">
                  {formatRatingServer(Number(service.ratingAverage), locale)} ·{" "}
                  {formatNumberServer(service.ratingCount, locale)} {t("common.reviews")}
                </span>
              </a>
            ) : (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5" aria-hidden />
                {t("reviews.noneYet")}
              </span>
            )}
            {service.publishedAt ? (
              <span>{formatDateServer(service.publishedAt, locale)}</span>
            ) : null}
          </div>

          <Separator className="my-6" />

          {/* Description */}
          <section aria-labelledby="about-service">
            <h2 id="about-service" className="text-lg font-bold">{t("services.detail.about")}</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">
              {description}
            </p>
          </section>

          {/* Includes */}
          {service.includes.length > 0 ? (
            <section className="mt-7" aria-labelledby="includes">
              <h2 id="includes" className="text-lg font-bold">{t("services.detail.includes")}</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {service.includes.map((item) => (
                  <li key={item} className="flex items-start gap-2 rounded-lg border bg-card p-3 text-xs shadow-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span className="leading-5">{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Keywords */}
          {service.keywords.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-1.5">
              {service.keywords.map((keyword) => (
                <Link
                  key={keyword}
                  href={`/services?search=${encodeURIComponent(keyword)}`}
                  className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-primary"
                >
                  {keyword}
                </Link>
              ))}
            </div>
          ) : null}

          {/* Reviews */}
          <section id="reviews" className="mt-10 scroll-mt-20" aria-labelledby="reviews-heading">
            <h2 id="reviews-heading" className="text-lg font-bold">
              {t("services.detail.reviews")}
              {reviewsResult.total > 0 ? (
                <span className="ms-2 text-sm font-normal text-muted-foreground" dir="ltr">
                  {formatNumberServer(reviewsResult.total, locale)}
                </span>
              ) : null}
            </h2>
            {reviewsResult.items.length === 0 ? (
              <p className="prose-ma mt-3 rounded-xl border border-dashed bg-card/60 p-6 text-center">
                {t("professionals.profile.noReviews")}
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {reviewsResult.items.map((review) => {
                  const identity = review.author.identity;
                  const author = identity?.firstName?.trim() || identity?.fullName?.trim() || "—";
                  return (
                    <li key={review.id} className="rounded-xl border bg-card p-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={identity?.avatarUrl ?? undefined} alt={author} />
                          <AvatarFallback className="bg-brand-50 text-[10px] font-semibold text-brand-700">
                            {initialsOf(author)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">{author}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatDateServer(review.createdAt, locale)}
                            {review.booking.city ? ` · ${cityName(review.booking.city, locale)}` : ""}
                          </p>
                        </div>
                        <RatingStars value={review.rating} size={13} />
                      </div>
                      {review.comment ? (
                        <p className="mt-3 text-xs leading-6 text-muted-foreground">{review.comment}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Similar */}
          {similar.length > 0 ? (
            <section className="mt-10" aria-labelledby="similar-heading">
              <h2 id="similar-heading" className="text-lg font-bold">{t("services.detail.similar")}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {similar.map((item) => (
                  <ServiceCard key={item.id} service={item} locale={locale} />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {/* ── Sticky side column ──────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <p className="text-xs text-muted-foreground">{t(`services.pricing.${service.pricingType}`)}</p>
            <p className="mt-1 text-2xl font-extrabold text-primary">
              {servicePriceLabel(
                { pricingType: service.pricingType, priceMin: service.priceMin, priceMax: service.priceMax },
                locale
              )}
            </p>
            {service.priceMax != null && service.priceMax > service.priceMin ? (
              <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                {formatMoney(service.priceMin, { locale })} – {formatMoney(service.priceMax, { locale })}
              </p>
            ) : null}

            {service.durationMin != null && service.durationMin > 0 ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {t("common.duration")}: {formatDurationServer(service.durationMin, locale)}
                {service.durationMax != null && service.durationMax > service.durationMin
                  ? ` – ${formatDurationServer(service.durationMax, locale)}`
                  : ""}
              </p>
            ) : null}

            {!isOwner ? (
              <div className="mt-5 space-y-2">
                {requestQuoteHref ? (
                  <Button asChild className="w-full" size="lg">
                    <Link href={requestQuoteHref}>{t("services.detail.requestQuote")}</Link>
                  </Button>
                ) : null}
                {messageHref ? (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={messageHref}>
                      <MessageSquare className="h-4 w-4" aria-hidden />
                      {t("services.detail.message")}
                    </Link>
                  </Button>
                ) : null}
                <FavoriteButton
                  targetType="SERVICE"
                  targetId={service.id}
                  initialFavorited={favoriteIds.includes(service.id)}
                  signedIn={Boolean(user)}
                  className="w-full"
                />
              </div>
            ) : (
              <Button asChild variant="outline" className="mt-5 w-full">
                <Link href="/professional/services">{t("nav.myServices")}</Link>
              </Button>
            )}
          </div>

          {/* Professional */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("services.detail.professional")}
            </p>
            <Link href={`/professionals/${professional.slug}`} className="group mt-3 flex items-center gap-3">
              <Avatar className="h-12 w-12 rounded-xl">
                <AvatarImage src={professional.avatarUrl ?? undefined} alt={professionalName} />
                <AvatarFallback className="rounded-xl bg-brand-50 font-semibold text-brand-700">
                  {initialsOf(professionalName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold transition-colors group-hover:text-primary">
                  {professionalName}
                  {isVerified ? (
                    <BadgeCheck className="h-4 w-4 shrink-0 text-brand-600" aria-label={t("common.verified")} />
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {cityName(professional.city, locale)}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground flip-rtl" aria-hidden />
            </Link>

            {professional.headline ? (
              <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{professional.headline}</p>
            ) : null}

            <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-center">
              <div>
                <dt className="text-[11px] text-muted-foreground">{t("common.rating")}</dt>
                <dd className="mt-0.5 text-sm font-bold" dir="ltr">
                  ★ {formatRatingServer(Number(professional.ratingAverage), locale)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">{t("common.completedJobs")}</dt>
                <dd className="mt-0.5 text-sm font-bold">{formatNumberServer(professional.completedJobs, locale)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">{t("common.responseRate")}</dt>
                <dd className="mt-0.5 text-sm font-bold">
                  {formatNumberServer(Math.round(professional.responseRate * 100), locale)}%
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">{t("common.experience")}</dt>
                <dd className="mt-0.5 text-sm font-bold">
                  {formatNumberServer(professional.yearsExperience, locale)}
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              {formatResponseTimeServer(professional.responseTimeMin, locale)}
            </p>

            {professional.phonePublic && professional.publicPhone ? (
              <a
                href={`tel:${professional.publicPhone}`}
                dir="ltr"
                className="mt-3 block rounded-lg border py-2 text-center text-xs font-semibold link-underline"
              >
                {professional.publicPhone}
              </a>
            ) : null}

            <Button asChild variant="ghost" className="mt-2 w-full text-xs text-primary">
              <Link href={`/professionals/${professional.slug}`}>
                {t("professionals.profile.viewPublic")}
              </Link>
            </Button>
          </div>

          {/* Service areas */}
          {service.areas.length > 0 ? (
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("common.serviceArea")}
              </p>
              <ul className="mt-3 space-y-2.5">
                {service.areas.map((area, index) => (
                  <li key={`${area.city}-${index}`} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      {cityName(area.city, locale)}
                      {area.neighborhood ? ` · ${area.neighborhood}` : ""}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {t("common.radius", { km: formatNumberServer(area.radiusKm, locale) })}
                      {area.travelFee > 0 ? ` · +${formatMoney(area.travelFee, { locale })}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
