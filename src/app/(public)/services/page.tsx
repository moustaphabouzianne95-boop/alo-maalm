import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";
import { pickLocalized } from "@/lib/i18n/localize";
import { formatNumberServer } from "@/lib/i18n/server-format";
import { CITIES, cityName } from "@/lib/constants/morocco";
import {
  buildPageHref,
  spBool,
  spEnum,
  spNumber,
  spOptionalString,
  spPage,
  type SearchParams,
} from "@/lib/utils/search-params";
import { listServices, type ServiceSort } from "@/server/services/service";
import { listCategories } from "@/server/categories/service";
import { getNavUser } from "@/components/layout/nav-session";
import { ServiceCard } from "@/components/services/service-card";
import {
  ServiceFiltersDesktop,
  ServiceFiltersMobile,
} from "@/components/services/service-filters";
import { SortSelect } from "@/components/shared/sort-select";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";

const SORTS: readonly ServiceSort[] = ["relevance", "rating", "price_asc", "price_desc", "newest"];

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "services.page.title") };
}

/**
 * Public service catalogue (§8): search + filters + sort, every parameter
 * persisted in the URL and validated before it reaches the query layer.
 */
export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);

  const sort = spEnum(sp.sort, SORTS, "relevance");
  const page = spPage(sp.page);
  const minRating = spNumber(sp.minRating);

  const [result, categoriesResult, user] = await Promise.all([
    listServices({
      search: spOptionalString(sp.search),
      categorySlug: spOptionalString(sp.category),
      city: spOptionalString(sp.city),
      minPrice: spNumber(sp.minPrice),
      maxPrice: spNumber(sp.maxPrice),
      minRating: minRating && minRating >= 1 && minRating <= 5 ? minRating : undefined,
      verifiedOnly: spBool(sp.verified),
      urgentOnly: spBool(sp.urgent),
      sort,
      page,
      perPage: 12,
    }),
    listCategories({ perPage: 50 }),
    getNavUser(),
  ]);

  const categories = categoriesResult.items.map((category) => ({
    value: category.slug,
    label: pickLocalized(category, locale),
  }));
  const cities = CITIES.map((city) => ({ value: city.slug, label: cityName(city.slug, locale) }));

  const sortOptions = [
    { value: "relevance", label: t("common.sort.relevance") },
    { value: "rating", label: t("common.sort.rating") },
    { value: "price_asc", label: t("common.sort.priceAsc") },
    { value: "price_desc", label: t("common.sort.priceDesc") },
    { value: "newest", label: t("common.sort.newest") },
  ];

  const hasFilters =
    spBool(sp.verified) ||
    spBool(sp.urgent) ||
    Boolean(
      spOptionalString(sp.search) ||
        spOptionalString(sp.category) ||
        spOptionalString(sp.city) ||
        spNumber(sp.minPrice) !== undefined ||
        spNumber(sp.maxPrice) !== undefined ||
        minRating !== undefined
    );

  const requestCtaHref = !user
    ? "/register?role=CUSTOMER"
    : user.role === "CUSTOMER"
      ? "/dashboard/requests/new"
      : "/";

  return (
    <div className="page-shell py-8 sm:py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("services.page.title")}</h1>
        <p className="prose-ma mt-1.5">
          {t("services.page.subtitle", { count: formatNumberServer(result.total, locale) })}
        </p>
      </header>

      <div className="mt-5 flex items-center justify-between gap-3 lg:hidden">
        <ServiceFiltersMobile categories={categories} cities={cities} />
        <SortSelect value={sort} options={sortOptions} />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <ServiceFiltersDesktop categories={categories} cities={cities} />
        </aside>

        <div>
          <div className="hidden justify-end lg:flex">
            <SortSelect value={sort} options={sortOptions} />
          </div>

          {result.items.length === 0 ? (
            <EmptyState
              className="mt-4"
              title={t("services.empty.title")}
              description={t("services.empty.body")}
              action={
                <>
                  <Button asChild size="sm">
                    <Link href={requestCtaHref}>{t("services.empty.cta")}</Link>
                  </Button>
                  {hasFilters ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href="/services">{t("common.clearFilters")}</Link>
                    </Button>
                  ) : null}
                </>
              }
            />
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((service) => (
                <ServiceCard key={service.id} service={service} locale={locale} />
              ))}
            </div>
          )}

          <Pagination
            className="mt-8"
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            perPage={result.perPage}
            hrefFor={(p) => buildPageHref("/services", sp, p)}
            locale={locale}
          />
        </div>
      </div>
    </div>
  );
}
