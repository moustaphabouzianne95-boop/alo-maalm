import Link from "next/link";
import {
  BadgeCheck,
  Banknote,
  Check,
  ChevronDown,
  HandCoins,
  MapPin,
  MessageSquare,
  Quote,
  Scale,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Briefcase,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CategoryCard } from "@/components/categories/category-card";
import { HeroSearch } from "@/components/home/hero-search";
import { HowItWorks } from "@/components/home/how-it-works";
import { ProfessionalCard } from "@/components/professionals/professional-card";
import { RatingStars } from "@/components/shared/rating-stars";
import { ServiceCard } from "@/components/services/service-card";
import { getNavUser } from "@/components/layout/nav-session";
import { CITIES, cityName } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { pickLocalized, pickLocalizedDescription } from "@/lib/i18n/localize";
import { formatDateServer, formatNumberServer, formatRatingServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { initialsOf } from "@/lib/utils";
import { listCategories } from "@/server/categories/service";
import { homeStats, homeTestimonials } from "@/server/home/service";
import { featuredProfessionals } from "@/server/professionals/service";
import { listServices } from "@/server/services/service";

/**
 * Landing page (§7).
 *
 * Rendered entirely on the server from live tables: the hero counters, the
 * featured professionals, the popular services and the testimonials are all
 * real rows, so what the marketing surface claims is what the product has.
 */
export default async function HomePage() {
  const [user, locale] = await Promise.all([getNavUser(), getLocale()]);
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);

  const [categoriesResult, featured, servicesResult, stats, testimonials] = await Promise.all([
    listCategories({ activeOnly: true, perPage: 20 }),
    featuredProfessionals(6),
    listServices({ perPage: 6, sort: "relevance" }),
    homeStats(),
    homeTestimonials(3),
  ]);

  const categories = categoriesResult.items.map((category) => ({
    slug: category.slug,
    name: pickLocalized(category, locale),
    description: pickLocalizedDescription(category, locale) || null,
    icon: category.icon,
    color: category.color,
    servicesCount: category.servicesCount,
  }));

  const primaryCta = !user
    ? { href: "/register?role=CUSTOMER", label: t("home.hero.cta.primary") }
    : user.role === "PROFESSIONAL"
      ? { href: "/professional", label: t("nav.dashboard") }
      : user.role === "ADMIN"
        ? { href: "/admin", label: t("nav.admin") }
        : { href: "/dashboard/requests/new", label: t("nav.postRequest") };

  const secondaryCta = !user
    ? { href: "/register?role=PROFESSIONAL", label: t("home.hero.cta.secondary") }
    : { href: "/services", label: t("nav.services") };

  const trustBadges = [
    { icon: ShieldCheck, label: t("home.hero.trust.verified") },
    { icon: Scale, label: t("home.hero.trust.offers") },
    { icon: HandCoins, label: t("home.hero.trust.cash") },
  ];

  const heroStats = [
    { icon: Users, value: formatNumberServer(stats.verifiedProfessionals, locale), label: t("home.hero.stats.professionals") },
    { icon: Briefcase, value: formatNumberServer(stats.publishedServices, locale), label: t("home.hero.stats.services") },
    { icon: MapPin, value: formatNumberServer(stats.cities, locale), label: t("home.hero.stats.cities") },
    { icon: Star, value: formatRatingServer(stats.averageRating, locale), label: t("home.hero.stats.rating") },
  ];

  const whyItems = [
    { icon: BadgeCheck, title: t("home.why.1.title"), body: t("home.why.1.body") },
    { icon: Banknote, title: t("home.why.2.title"), body: t("home.why.2.body") },
    { icon: MapPin, title: t("home.why.3.title"), body: t("home.why.3.body") },
    { icon: MessageSquare, title: t("home.why.4.title"), body: t("home.why.4.body") },
    { icon: Star, title: t("home.why.5.title"), body: t("home.why.5.body") },
    { icon: HandCoins, title: t("home.why.6.title"), body: t("home.why.6.body") },
  ];

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="pattern-zellige border-b bg-gradient-to-b from-brand-50/70 to-background">
        <div className="page-shell py-12 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-gold-500" aria-hidden />
              {t("brand.tagline")}
            </span>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-balance sm:text-4xl lg:text-5xl">
              {t("home.hero.title")}
            </h1>
            <p className="prose-ma mx-auto mt-4 max-w-2xl text-base text-balance">{t("home.hero.subtitle")}</p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="h-12 px-7 text-base">
                <Link href={primaryCta.href}>{primaryCta.label}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base">
                <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
              </Button>
            </div>

            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              {trustBadges.map((badge) => (
                <li key={badge.label} className="flex items-center gap-1.5">
                  <badge.icon className="h-4 w-4 text-brand-600" aria-hidden />
                  {badge.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="mx-auto mt-9 max-w-4xl">
            <HeroSearch cities={CITIES.map((city) => ({ slug: city.slug, name: cityName(city.slug, locale) }))} />

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {categories.slice(0, 6).map((category) => (
                <Link
                  key={category.slug}
                  href={`/categories/${category.slug}`}
                  className="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </div>

          <dl className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-3 lg:grid-cols-4">
            {heroStats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center rounded-xl border bg-card/80 px-4 py-5 text-center shadow-sm backdrop-blur"
              >
                <stat.icon className="h-5 w-5 text-primary" aria-hidden />
                <dd className="mt-2 text-2xl font-extrabold" dir="ltr">
                  {stat.value}
                </dd>
                <dt className="mt-1 text-xs text-muted-foreground">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Categories ───────────────────────────────────────────────── */}
      <section className="section">
        <div className="page-shell">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{t("home.categories.title")}</h2>
              <p className="prose-ma mt-2 max-w-2xl">{t("home.categories.subtitle")}</p>
            </div>
            <Button asChild variant="ghost" className="text-primary">
              <Link href="/categories">{t("common.viewAll")}</Link>
            </Button>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categories.slice(0, 10).map((category) => (
              <CategoryCard key={category.slug} category={category} locale={locale} compact />
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured professionals ───────────────────────────────────── */}
      <section className="section border-t bg-muted/30">
        <div className="page-shell">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{t("home.featured.title")}</h2>
              <p className="prose-ma mt-2 max-w-2xl">{t("home.featured.subtitle")}</p>
            </div>
            <Button asChild variant="ghost" className="text-primary">
              <Link href="/professionals">{t("common.viewAll")}</Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((professional) => (
              <ProfessionalCard key={professional.id} professional={professional} locale={locale} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Popular services ─────────────────────────────────────────── */}
      <section className="section">
        <div className="page-shell">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{t("home.popularServices.title")}</h2>
              <p className="prose-ma mt-2 max-w-2xl">{t("home.popularServices.subtitle")}</p>
            </div>
            <Button asChild variant="ghost" className="text-primary">
              <Link href="/services">{t("common.viewAll")}</Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {servicesResult.items.map((service) => (
              <ServiceCard key={service.id} service={service} locale={locale} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="section border-t bg-muted/30">
        <div className="page-shell">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight">{t("home.howItWorks.title")}</h2>
            <p className="prose-ma mx-auto mt-2 max-w-2xl">{t("home.howItWorks.subtitle")}</p>
          </div>
          <div className="mt-8">
            <HowItWorks />
          </div>
        </div>
      </section>

      {/* ── Why us ───────────────────────────────────────────────────── */}
      <section className="section">
        <div className="page-shell">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight">{t("home.why.title")}</h2>
            <p className="prose-ma mx-auto mt-2 max-w-2xl">{t("home.why.subtitle")}</p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {whyItems.map((item) => (
              <div key={item.title} className="rounded-xl border bg-card p-5 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-3.5 text-sm font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-xs leading-6 text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials (real reviews) ──────────────────────────────── */}
      {testimonials.length ? (
        <section className="section border-t bg-muted/30">
          <div className="page-shell">
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight">{t("home.testimonials.title")}</h2>
              <p className="prose-ma mx-auto mt-2 max-w-2xl">{t("home.testimonials.subtitle")}</p>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <figure key={testimonial.id} className="flex flex-col rounded-xl border bg-card p-5 shadow-sm">
                  <Quote className="h-6 w-6 text-brand-300" aria-hidden />
                  <blockquote className="mt-3 line-clamp-5 text-sm leading-7 text-foreground/90">
                    {testimonial.comment}
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-3 border-t pt-4">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-brand-50 text-xs font-semibold text-brand-700">
                        {initialsOf(testimonial.authorName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{testimonial.authorName}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {testimonial.city ? cityName(testimonial.city, locale) : "—"} ·{" "}
                        {formatDateServer(testimonial.createdAt, locale)}
                      </p>
                    </div>
                    <RatingStars value={testimonial.rating} size={13} />
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Professional CTA ─────────────────────────────────────────── */}
      <section className="section">
        <div className="page-shell">
          <div className="overflow-hidden rounded-2xl bg-ink-950 px-6 py-12 text-center sm:px-12">
            <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{t("home.proCta.title")}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-ink-200">{t("home.proCta.subtitle")}</p>
            <ul className="mx-auto mt-6 flex max-w-2xl flex-col items-center gap-2 text-sm text-ink-100 sm:flex-row sm:justify-center sm:gap-6">
              {[t("home.proCta.benefit1"), t("home.proCta.benefit2"), t("home.proCta.benefit3")].map((benefit) => (
                <li key={benefit} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-brand-400" aria-hidden />
                  {benefit}
                </li>
              ))}
            </ul>
            <Button asChild variant="gold" size="lg" className="mt-8 h-12 px-8 text-base">
              <Link href={user?.role === "PROFESSIONAL" ? "/professional" : "/register?role=PROFESSIONAL"}>
                {t("home.proCta.button")}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Cities ───────────────────────────────────────────────────── */}
      <section className="border-t py-10">
        <div className="page-shell">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("footer.cities")}</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {CITIES.map((city) => (
              <li key={city.slug}>
                <Link
                  href={`/services?city=${city.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {cityName(city.slug, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section id="faq" className="section border-t bg-muted/30 scroll-mt-16">
        <div className="page-shell max-w-4xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight">{t("home.faq.title")}</h2>
          </div>
          <div className="mt-8 grid gap-3">
            {[1, 2, 3, 4, 5, 6].map((index) => (
              <details
                key={index}
                className="group rounded-xl border bg-card p-4 shadow-sm open:shadow-card"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                  {t(`home.faq.q${index}`)}
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="mt-3 text-xs leading-6 text-muted-foreground">{t(`home.faq.a${index}`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
