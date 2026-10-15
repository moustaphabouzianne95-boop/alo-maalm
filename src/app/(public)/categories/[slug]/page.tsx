import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";
import { pickLocalized, pickLocalizedDescription } from "@/lib/i18n/localize";
import { formatNumberServer } from "@/lib/i18n/server-format";
import { buildPageHref, spPage, type SearchParams } from "@/lib/utils/search-params";
import { getCategoryBySlug } from "@/server/categories/service";
import { listServices } from "@/server/services/service";
import { listProfessionals } from "@/server/professionals/service";
import { CategoryIcon } from "@/components/icons/category-icon";
import { ServiceCard } from "@/components/services/service-card";
import { ProfessionalCard } from "@/components/professionals/professional-card";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  try {
    const category = await getCategoryBySlug(slug, true);
    return {
      title: pickLocalized(category, locale),
      description: pickLocalizedDescription(category, locale) || undefined,
    };
  } catch {
    return { title: translate(locale, "categories.page.title") };
  }
}

/** Category landing: the trade's professionals and services in one place. */
export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);

  let category: Awaited<ReturnType<typeof getCategoryBySlug>>;
  try {
    category = await getCategoryBySlug(slug, true);
  } catch {
    notFound();
  }

  const page = spPage(sp.page);
  const [services, professionals] = await Promise.all([
    listServices({ categorySlug: slug, page, perPage: 12 }),
    listProfessionals({ categorySlug: slug, perPage: 4 }),
  ]);

  const name = pickLocalized(category, locale);
  const description = pickLocalizedDescription(category, locale);
  const tint = category.color ?? "#0f6b48";

  return (
    <div className="page-shell py-8 sm:py-10">
      {/* Header */}
      <header className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${tint}1a`, color: tint }}
          >
            <CategoryIcon name={category.icon} className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
            {description ? <p className="prose-ma mt-2 max-w-2xl">{description}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/services?category=${slug}`}>
                  {t("nav.services")}
                  <span className="text-muted-foreground" dir="ltr">
                    ({formatNumberServer(services.total, locale)})
                  </span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/professionals?category=${slug}`}>
                  {t("nav.professionals")}
                  <span className="text-muted-foreground" dir="ltr">
                    ({formatNumberServer(professionals.total, locale)})
                  </span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Professionals */}
      {professionals.items.length > 0 ? (
        <section className="mt-10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{t("nav.professionals")}</h2>
            <Link
              href={`/professionals?category=${slug}`}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {t("common.viewAll")}
              <ArrowRight className="h-3.5 w-3.5 flip-rtl" aria-hidden />
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {professionals.items.map((professional) => (
              <ProfessionalCard key={professional.id} professional={professional} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Services */}
      <section className="mt-10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">
            {t("nav.services")}
            <span className="ms-2 text-sm font-normal text-muted-foreground" dir="ltr">
              {formatNumberServer(services.total, locale)}
            </span>
          </h2>
          <Link
            href={`/services?category=${slug}`}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {t("common.viewAll")}
            <ArrowRight className="h-3.5 w-3.5 flip-rtl" aria-hidden />
          </Link>
        </div>

        {services.items.length === 0 ? (
          <EmptyState
            className="mt-4"
            title={t("services.empty.title")}
            description={t("services.empty.body")}
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={`/services?category=${slug}`}>{t("common.viewAll")}</Link>
              </Button>
            }
          />
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {services.items.map((service) => (
              <ServiceCard key={service.id} service={service} locale={locale} />
            ))}
          </div>
        )}

        <Pagination
          className="mt-8"
          page={services.page}
          totalPages={services.totalPages}
          total={services.total}
          perPage={services.perPage}
          hrefFor={(p) => buildPageHref(`/categories/${slug}`, sp, p)}
          locale={locale}
        />
      </section>
    </div>
  );
}
