import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Clock,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  Percent,
  Phone,
  Star,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CategoryIcon } from "@/components/icons/category-icon";
import { FavoriteButton } from "@/components/shared/favorite-button";
import { RatingStars } from "@/components/shared/rating-stars";
import { Pagination } from "@/components/shared/pagination";
import { servicePriceLabel } from "@/components/services/service-card";
import { getSession } from "@/lib/auth/session";
import { cityName, formatMoney } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { pickLocalized } from "@/lib/i18n/localize";
import {
  formatDateServer,
  formatNumberServer,
  formatRatingServer,
  formatResponseTimeServer,
} from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { spPage, type SearchParams } from "@/lib/utils/search-params";
import { initialsOf, truncate } from "@/lib/utils";
import { favoriteIdsFor } from "@/server/favorites/service";
import { getPublicProfessionalBySlug } from "@/server/professionals/service";
import { listReviews, reviewSummary } from "@/server/reviews/service";

/** Endonyms — language names are the same in every UI language. */
const LANGUAGE_LABELS: Record<string, string> = {
  ar: "العربية",
  ary: "الدارجة",
  fr: "Français",
  en: "English",
  es: "Español",
  tzm: "ⵜⴰⵎⴰⵣⵉⵖⵜ",
};

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  try {
    const profile = await getPublicProfessionalBySlug(slug);
    const name = profile.businessName?.trim() || profile.user.identity?.fullName?.trim() || "—";
    return {
      title: name,
      description: truncate(profile.headline ?? profile.about ?? "", 160),
      alternates: { canonical: `/professionals/${profile.slug}` },
    };
  } catch {
    return { title: translate(locale, "professionals.page.title") };
  }
}

/**
 * Public professional profile (§6, §51).
 *
 * Trust & safety: no email, no private phone. `publicPhone` is rendered only
 * when the professional explicitly set `phonePublic`.
 */
export default async function ProfessionalProfilePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);

  let profile: Awaited<ReturnType<typeof getPublicProfessionalBySlug>>;
  try {
    profile = await getPublicProfessionalBySlug(slug);
  } catch {
    notFound();
  }

  const session = await getSession();
  const user = session?.user ?? null;
  const reviewsPage = spPage(sp.rpage);

  const [summary, reviewsResult, favoriteIds] = await Promise.all([
    reviewSummary(profile.id),
    listReviews({ professionalId: profile.id, page: reviewsPage, perPage: 6 }),
    favoriteIdsFor(user?.id, "PROFESSIONAL", [profile.id]),
  ]);

  const name = profile.businessName?.trim() || profile.user.identity?.fullName?.trim() || "—";
  const isVerified = profile.verificationStatus === "VERIFIED";
  const isOwnProfile = Boolean(user?.professional && user.professional.id === profile.id);
  const totalRatings = Math.max(1, summary.count);

  const availabilityLabel =
    profile.availabilityStatus === "AVAILABLE"
      ? t("common.available")
      : profile.availabilityStatus === "BUSY"
        ? t("common.busy")
        : t("common.unavailable");

  const requestQuoteHref = !user
    ? "/register?role=CUSTOMER"
    : user.role === "CUSTOMER"
      ? `/dashboard/requests/new?professionalId=${profile.id}`
      : null;
  const messageHref = !user
    ? `/login?next=${encodeURIComponent(`/professionals/${profile.slug}`)}`
    : user.role === "CUSTOMER"
      ? `/dashboard/messages?professional=${profile.id}`
      : null;

  return (
    <div className="page-shell py-6 sm:py-8">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-primary">{t("nav.home")}</Link>
        <span aria-hidden>/</span>
        <Link href="/professionals" className="hover:text-primary">{t("nav.professionals")}</Link>
      </nav>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          {/* Header card */}
          <header className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="pattern-zellige h-28 bg-gradient-to-b from-brand-100/70 to-brand-50/40 sm:h-36" />
            <div className="px-5 pb-5 sm:px-7 sm:pb-7">
              <div className="-mt-12 flex flex-wrap items-end gap-4 sm:-mt-14">
                <Avatar className="h-24 w-24 rounded-2xl border-4 border-card shadow-card sm:h-28 sm:w-28">
                  <AvatarImage src={profile.avatarUrl ?? undefined} alt={name} />
                  <AvatarFallback className="rounded-2xl bg-brand-50 text-xl font-bold text-brand-700">
                    {initialsOf(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{name}</h1>
                    {isVerified ? (
                      <Badge variant="verified" className="gap-1">
                        <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                        {t("professionals.profile.verified")}
                      </Badge>
                    ) : (
                      <Badge variant="muted">{t("professionals.profile.pending")}</Badge>
                    )}
                    <Badge
                      variant={
                        profile.availabilityStatus === "AVAILABLE"
                          ? "success"
                          : profile.availabilityStatus === "BUSY"
                            ? "warning"
                            : "muted"
                      }
                    >
                      {availabilityLabel}
                    </Badge>
                  </div>
                  {profile.headline ? (
                    <p className="mt-1 text-sm text-muted-foreground">{profile.headline}</p>
                  ) : null}
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      {cityName(profile.city, locale)}
                      {profile.neighborhood ? ` · ${profile.neighborhood}` : ""}
                    </span>
                    <span>
                      {t("common.memberSince", {
                        date: formatDateServer(profile.user.createdAt, locale),
                      })}
                    </span>
                  </p>
                </div>
              </div>

              {/* Stats */}
              <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    icon: Star,
                    value: `${formatRatingServer(summary.average, locale)} ★`,
                    label: `${t("professionals.profile.stat.rating")} · ${formatNumberServer(summary.count, locale)}`,
                  },
                  {
                    icon: Briefcase,
                    value: formatNumberServer(profile.completedJobs, locale),
                    label: t("professionals.profile.stat.jobs"),
                  },
                  {
                    icon: Percent,
                    value: `${formatNumberServer(Math.round(profile.responseRate * 100), locale)}%`,
                    label: t("professionals.profile.stat.responseRate"),
                  },
                  {
                    icon: Clock,
                    value: formatResponseTimeServer(profile.responseTimeMin, locale),
                    label: t("professionals.profile.stat.responseTime"),
                  },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border bg-background p-3 text-center">
                    <stat.icon className="mx-auto h-4 w-4 text-primary" aria-hidden />
                    <dd className="mt-1.5 truncate text-sm font-bold" title={stat.value}>
                      {stat.value}
                    </dd>
                    <dt className="mt-0.5 truncate text-[11px] text-muted-foreground" title={stat.label}>
                      {stat.label}
                    </dt>
                  </div>
                ))}
              </dl>

              {/* Languages */}
              {profile.languages.length > 0 ? (
                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("professionals.profile.languages")}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {profile.languages.map((code) => (
                      <li key={code} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">
                        {LANGUAGE_LABELS[code.toLowerCase()] ?? code.toUpperCase()}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </header>

          {/* About */}
          {profile.about ? (
            <section className="mt-8" aria-labelledby="about-pro">
              <h2 id="about-pro" className="text-lg font-bold">{t("professionals.profile.about")}</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                {profile.about}
              </p>
            </section>
          ) : null}

          {/* Services */}
          <section className="mt-8" aria-labelledby="pro-services">
            <h2 id="pro-services" className="text-lg font-bold">
              {t("professionals.profile.services")}
              {profile.services.length > 0 ? (
                <span className="ms-2 text-sm font-normal text-muted-foreground" dir="ltr">
                  {formatNumberServer(profile.services.length, locale)}
                </span>
              ) : null}
            </h2>
            {profile.services.length === 0 ? (
              <p className="prose-ma mt-3 rounded-xl border border-dashed bg-card/60 p-6 text-center">
                {t("professionals.profile.noServices")}
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {profile.services.map((service) => (
                  <li key={service.id}>
                    <Link
                      href={`/services/${service.slug}`}
                      className="group flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card sm:p-4"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg">
                        {service.images[0]?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- served from our own storage route
                          <img
                            src={service.images[0].url}
                            alt=""
                            loading="lazy"
                            className="h-11 w-11 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted">
                            <CategoryIcon name={service.category.icon} className="h-5 w-5 text-muted-foreground" />
                          </span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold transition-colors group-hover:text-primary">
                          {pickLocalized(service, locale, "title")}
                        </p>
                        <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{pickLocalized(service.category, locale)}</span>
                          {service.ratingCount > 0 ? (
                            <span className="flex items-center gap-1" dir="ltr">
                              <Star className="h-3 w-3 fill-gold-400 text-gold-400" aria-hidden />
                              {formatRatingServer(Number(service.ratingAverage), locale)}
                            </span>
                          ) : null}
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" aria-hidden />
                            {cityName(service.city, locale)}
                          </span>
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-primary">
                        {servicePriceLabel(
                          { pricingType: service.pricingType, priceMin: service.priceMin, priceMax: service.priceMax },
                          locale
                        )}
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground flip-rtl" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Portfolio */}
          {profile.portfolio.length > 0 ? (
            <section className="mt-8" aria-labelledby="pro-portfolio">
              <h2 id="pro-portfolio" className="text-lg font-bold">{t("professionals.profile.portfolio")}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {profile.portfolio.map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- served from our own storage route
                      <img src={item.imageUrl} alt={item.title} loading="lazy" className="h-36 w-full object-cover" />
                    ) : (
                      <div className="flex h-24 items-center justify-center bg-muted/50">
                        <ImageIcon className="h-6 w-6 text-muted-foreground/50" aria-hidden />
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="text-sm font-semibold">{item.title}</h3>
                      {item.description ? (
                        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {item.description}
                        </p>
                      ) : null}
                      <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3" aria-hidden />
                        {item.city ? cityName(item.city, locale) : "—"}
                        {item.completedAt ? ` · ${formatDateServer(item.completedAt, locale)}` : ""}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {/* Reviews */}
          <section className="mt-10" aria-labelledby="pro-reviews">
            <h2 id="pro-reviews" className="text-lg font-bold">
              {t("professionals.profile.reviews")}
              <span className="ms-2 text-sm font-normal text-muted-foreground" dir="ltr">
                {formatNumberServer(summary.count, locale)}
              </span>
            </h2>

            {summary.count === 0 ? (
              <p className="prose-ma mt-3 rounded-xl border border-dashed bg-card/60 p-6 text-center">
                {t("professionals.profile.noReviews")}
              </p>
            ) : (
              <>
                {/* Distribution */}
                <div className="mt-4 rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-center">
                      <p className="text-3xl font-extrabold" dir="ltr">
                        {formatRatingServer(summary.average, locale)}
                      </p>
                      <RatingStars value={summary.average} className="mt-1 justify-center" />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatNumberServer(summary.count, locale)} {t("common.reviews")}
                      </p>
                    </div>
                    <div className="min-w-40 flex-1 space-y-1.5">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = summary.distribution[star] ?? 0;
                        const pct = Math.round((count / totalRatings) * 100);
                        return (
                          <div key={star} className="flex items-center gap-2 text-[11px]">
                            <span className="w-6 shrink-0 text-muted-foreground" dir="ltr">
                              {star} ★
                            </span>
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <span className="block h-full rounded-full bg-gold-400" style={{ width: `${pct}%` }} />
                            </span>
                            <span className="w-6 shrink-0 text-end text-muted-foreground" dir="ltr">
                              {formatNumberServer(count, locale)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

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
                            <p className="truncate text-[11px] text-muted-foreground">
                              {formatDateServer(review.createdAt, locale)}
                              {review.service?.title ? ` · ${review.service.title}` : ""}
                            </p>
                          </div>
                          <RatingStars value={review.rating} size={13} />
                        </div>
                        {review.comment ? (
                          <p className="mt-3 text-xs leading-6 text-muted-foreground">{review.comment}</p>
                        ) : null}
                        {review.reply ? (
                          <div className="mt-3 rounded-lg border-s-2 border-primary/40 bg-muted/50 p-3">
                            <p className="text-[11px] font-semibold text-primary">
                              {t("reviews.reply")}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {review.reply}
                            </p>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                <Pagination
                  className="mt-6"
                  page={reviewsResult.page}
                  totalPages={reviewsResult.totalPages}
                  hrefFor={(p) => {
                    const query = new URLSearchParams();
                    for (const [key, value] of Object.entries(sp)) {
                      if (key === "rpage" || typeof value !== "string" || !value) continue;
                      query.set(key, value);
                    }
                    query.set("rpage", String(p));
                    return `/professionals/${profile.slug}?${query.toString()}`;
                  }}
                  locale={locale}
                />
              </>
            )}
          </section>
        </div>

        {/* ── Side column ─────────────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          {!isOwnProfile ? (
            <div className="space-y-2 rounded-2xl border bg-card p-5 shadow-card">
              {requestQuoteHref ? (
                <Button asChild size="lg" className="w-full">
                  <Link href={requestQuoteHref}>{t("professionals.profile.requestQuote")}</Link>
                </Button>
              ) : null}
              {messageHref ? (
                <Button asChild variant="outline" className="w-full">
                  <Link href={messageHref}>
                    <MessageSquare className="h-4 w-4" aria-hidden />
                    {t("professionals.profile.message")}
                  </Link>
                </Button>
              ) : null}
              <FavoriteButton
                targetType="PROFESSIONAL"
                targetId={profile.id}
                initialFavorited={favoriteIds.includes(profile.id)}
                signedIn={Boolean(user)}
                className="w-full"
              />
              {profile.phonePublic && profile.publicPhone ? (
                <a
                  href={`tel:${profile.publicPhone}`}
                  dir="ltr"
                  className="flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-semibold link-underline"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  {profile.publicPhone}
                </a>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2 rounded-2xl border bg-card p-5 shadow-card">
              <Button asChild className="w-full">
                <Link href="/professional">{t("nav.dashboard")}</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/professional/profile">{t("professionals.profile.editProfile")}</Link>
              </Button>
            </div>
          )}

          {/* Service area */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("professionals.profile.serviceArea")}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold">
              <MapPin className="h-4 w-4 text-primary" aria-hidden />
              {cityName(profile.city, locale)}
              {profile.serviceRadiusKm ? ` · ${t("common.radius", { km: formatNumberServer(profile.serviceRadiusKm, locale) })}` : ""}
            </p>
            {profile.areas.length > 0 ? (
              <>
                <Separator className="my-3" />
                <ul className="space-y-2">
                  {profile.areas.map((area, index) => (
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
              </>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
