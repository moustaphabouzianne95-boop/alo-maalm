import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";
import { pickLocalized, pickLocalizedDescription } from "@/lib/i18n/localize";
import { listCategories } from "@/server/categories/service";
import { CategoryCard } from "@/components/categories/category-card";
import { EmptyState } from "@/components/shared/empty-state";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "categories.page.title") };
}

/** All twenty trades, ordered by the admin-managed `sortOrder`. */
export default async function CategoriesPage() {
  const locale = await getLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const { items } = await listCategories({ activeOnly: true, perPage: 50 });

  return (
    <div className="page-shell py-8 sm:py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("categories.page.title")}</h1>
        <p className="prose-ma mt-1.5 max-w-2xl">{t("categories.page.subtitle")}</p>
      </header>

      {items.length === 0 ? (
        <EmptyState className="mt-8" title={t("categories.empty")} />
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((category) => (
            <CategoryCard
              key={category.id}
              locale={locale}
              category={{
                slug: category.slug,
                name: pickLocalized(category, locale),
                description: pickLocalizedDescription(category, locale) || null,
                icon: category.icon,
                color: category.color,
                servicesCount: category.servicesCount,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
