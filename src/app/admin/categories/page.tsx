import type { Metadata } from "next";
import { CategoryCreateForm, CategoryToggle } from "@/components/admin/moderation-actions";
import { UrlSearch } from "@/components/dashboard/url-search";
import { Pagination } from "@/components/shared/pagination";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { getLocale } from "@/lib/i18n/get-locale";
import { pickLocalized } from "@/lib/i18n/localize";
import { translate } from "@/lib/i18n/translate";
import { buildPageHref, spOptionalString, spPage, type SearchParams } from "@/lib/utils/search-params";
import { listCategories } from "@/server/categories/service";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "admin.categories") };
}

export default async function AdminCategoriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const result = await listCategories({
    activeOnly: false,
    withCounts: true,
    search: spOptionalString(sp.search),
    page: spPage(sp.page),
    perPage: 30,
  });

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" size="lg" title={t("admin.categories")} />
      <CategoryCreateForm />
      <UrlSearch placeholder={t("common.search")} className="sm:max-w-xs" />
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {result.items.map((category) => (
          <li key={category.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">{pickLocalized(category, locale)}</p>
              <p className="text-xs text-muted-foreground">
                {category.slug} · {category.servicesCount} · {category.requestsCount}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge value={category.isActive ? "ACTIVE" : "PAUSED"} label={category.isActive ? t("services.status.PUBLISHED") : t("services.status.PAUSED")} size="sm" />
              <CategoryToggle id={category.id} active={category.isActive} />
            </div>
          </li>
        ))}
      </ul>
      <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={result.perPage} locale={locale} hrefFor={(next) => buildPageHref("/admin/categories", sp, next)} />
    </div>
  );
}
