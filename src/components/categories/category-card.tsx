import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CategoryIcon } from "@/components/icons/category-icon";
import { translate } from "@/lib/i18n/translate";
import type { LangCode } from "@/lib/i18n/config";
import { formatNumberServer } from "@/lib/i18n/server-format";
import { cn } from "@/lib/utils";

export interface CategoryCardData {
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  color: string | null;
  servicesCount: number;
  professionalsCount?: number;
}

interface CategoryCardProps {
  category: CategoryCardData;
  locale: LangCode;
  className?: string;
  /** Compact variant for the home grid: hides the description. */
  compact?: boolean;
}

/**
 * Trade card linking to the category page (§7).
 *
 * The tint comes from `Category.color` stored in the database, so the palette
 * stays consistent between the API, the admin form and the public UI.
 */
export function CategoryCard({ category, locale, className, compact = false }: CategoryCardProps) {
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const tint = category.color ?? "#0f6b48";

  return (
    <Link
      href={`/categories/${category.slug}`}
      className={cn(
        "group flex flex-col rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card",
        className
      )}
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105"
        style={{ backgroundColor: `${tint}1a`, color: tint }}
      >
        <CategoryIcon name={category.icon} />
      </span>

      <h3 className="mt-3 text-sm font-semibold transition-colors group-hover:text-primary">
        {category.name}
      </h3>

      {!compact && category.description ? (
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{category.description}</p>
      ) : null}

      <p className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5 text-[11px] text-muted-foreground">
        <span>
          {t("categories.servicesCount", { count: formatNumberServer(category.servicesCount, locale) })}
          {category.professionalsCount != null
            ? ` · ${t("categories.professionalsCount", { count: formatNumberServer(category.professionalsCount, locale) })}`
            : ""}
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 flip-rtl transition-colors group-hover:text-primary" aria-hidden />
      </p>
    </Link>
  );
}
