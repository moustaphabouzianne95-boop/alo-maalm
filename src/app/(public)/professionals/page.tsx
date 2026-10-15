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
import { listProfessionals, type ProfessionalSort } from "@/server/professionals/service";
import { listCategories } from "@/server/categories/service";
import { ProfessionalCard } from "@/components/professionals/professional-card";
import {
  ProfessionalFiltersDesktop,
  ProfessionalFiltersMobile,
} from "@/components/professionals/professional-filters";
import { SortSelect } from "@/components/shared/sort-select";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";

const SORTS: readonly ProfessionalSort[] = ["relevance", "rating", "jobs", "newest", "response"];
const AVAILABILITY = ["AVAILABLE", "BUSY", "UNAVAILABLE"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "professionals.page.title") };
}

/**
 * Professional directory (§8): the trust signals (verification, ratings,
 * completed jobs) come straight from the server-side card projection — never
 * from client input.
 */
export default async function ProfessionalsPage({
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
  const availabilityRaw = spOptionalString(sp.availability);
  const availability =
    availabilityRaw && (AVAILABILITY as readonly string[]).includes(availabilityRaw)
      ? (availabilityRaw as (typeof AVAILABILITY)[number])
      : undefined;

  const [result, categoriesResult] = await Promise.all([
    listProfessionals({
      search: spOptionalString(sp.search),
      categorySlug: spOptionalString(sp.category),
      city: spOptionalString(sp.city),
      verifiedOnly: spBool(sp.verified),
      availability,
      minRating: minRating && minRating >= 1 && minRating <= 5 ? minRating : undefined,
      sort,
      page,
      perPage: 12,
    }),
    listCategories({ perPage: 50 }),
  ]);

  const categories = categoriesResult.items.map((category) => ({
    value: category.slug,
    label: pickLocalized(category, locale),
  }));
  const cities = CITIES.map((city) => ({ value: city.slug, label: cityName(city.slug, locale) }));
  const availabilityOptions = [
    { value: "AVAILABLE", label: t("common.available") },
    { value: "BUSY", label: t("common.busy") },
    { value: "UNAVAILABLE", label: t("common.unavailable") },
  ];

  const sortOptions = [
    { value: "relevance", label: t("common.sort.relevance") },
    { value: "rating", label: t("common.sort.rating") },
    { value: "jobs", label: t("professionals.sort.jobs") },
    { value: "response", label: t("professionals.sort.response") },
    { value: "newest", label: t("common.sort.newest") },
  ];

  return (
    <div className="page-shell py-8 sm:py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("professionals.page.title")}</h1>
        <p className="prose-ma mt-1.5">
          {t("professionals.page.subtitle", { count: formatNumberServer(result.total, locale) })}
        </p>
      </header>

      <div className="mt-5 flex items-center justify-between gap-3 lg:hidden">
        <ProfessionalFiltersMobile
          categories={categories}
          cities={cities}
          availability={availabilityOptions}
        />
        <SortSelect value={sort} options={sortOptions} />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <ProfessionalFiltersDesktop
            categories={categories}
            cities={cities}
            availability={availabilityOptions}
          />
        </aside>

        <div>
          <div className="hidden justify-end lg:flex">
            <SortSelect value={sort} options={sortOptions} />
          </div>

          {result.items.length === 0 ? (
            <EmptyState
              className="mt-4"
              title={t("professionals.empty.title")}
              description={t("professionals.empty.body")}
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/professionals">{t("common.clearFilters")}</Link>
                </Button>
              }
            />
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((professional) => (
                <ProfessionalCard key={professional.id} professional={professional} locale={locale} />
              ))}
            </div>
          )}

          <Pagination
            className="mt-8"
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            perPage={result.perPage}
            hrefFor={(p) => buildPageHref("/professionals", sp, p)}
            locale={locale}
          />
        </div>
      </div>
    </div>
  );
}
