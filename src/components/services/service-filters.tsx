"use client";

import * as React from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n/provider";
import { useDebouncedParam, useUrlFilters } from "@/components/shared/use-url-filters";
import {
  CheckboxFilter,
  ClearFiltersButton,
  OptionSelect,
  RatingSelect,
  type FilterOption,
} from "@/components/shared/filter-controls";
import { cn } from "@/lib/utils";

interface ServiceFiltersProps {
  categories: FilterOption[];
  cities: FilterOption[];
  className?: string;
}

function PriceForm() {
  const { t } = useI18n();
  const { apply, get } = useUrlFilters();
  const [draft, setDraft] = React.useState<{ min: string; max: string } | null>(null);
  const min = draft?.min ?? get("minPrice");
  const max = draft?.max ?? get("maxPrice");

  return (
    <form
      className="space-y-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        apply({ minPrice: min || null, maxPrice: max || null });
      }}
    >
      <Label className="text-xs font-medium text-muted-foreground">{t("common.priceRange")}</Label>
      <div className="flex items-center gap-2">
        <Input
          name="minPrice"
          type="number"
          min={0}
          inputMode="numeric"
          placeholder={t("common.from")}
          className="h-9 text-xs"
          value={min}
          onChange={(event) => setDraft({ min: event.target.value, max })}
        />
        <span className="text-xs text-muted-foreground" aria-hidden>
          —
        </span>
        <Input
          name="maxPrice"
          type="number"
          min={0}
          inputMode="numeric"
          placeholder={t("common.to")}
          className="h-9 text-xs"
          value={max}
          onChange={(event) => setDraft({ min, max: event.target.value })}
        />
      </div>
      <Button type="submit" variant="secondary" size="sm" className="w-full text-xs">
        {t("common.apply")}
      </Button>
    </form>
  );
}

/** The filter form itself — rendered in the desktop sidebar and in the mobile sheet. */
export function ServiceFiltersPanel({ categories, cities, className }: ServiceFiltersProps) {
  const { t } = useI18n();
  const [search, setSearch] = useDebouncedParam("search");

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("services.filters.title")}</h2>
        <ClearFiltersButton />
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("services.search.placeholder")}
          aria-label={t("services.search.placeholder")}
          className="h-9 ps-8 text-xs"
          maxLength={120}
        />
      </div>

      <OptionSelect label={t("common.category")} param="category" options={categories} />
      <OptionSelect label={t("common.city")} param="city" options={cities} />
      <PriceForm />
      <RatingSelect label={t("services.filters.minRating")} />

      <div className="space-y-2.5 border-t pt-4">
        <CheckboxFilter param="verified" label={t("common.verifiedOnly")} />
        <CheckboxFilter param="urgent" label={t("services.filters.urgent")} />
      </div>
    </div>
  );
}

export function ServiceFiltersDesktop(props: ServiceFiltersProps) {
  return (
    <div className="sticky top-20 rounded-xl border bg-card p-4 shadow-sm">
      <ServiceFiltersPanel {...props} />
    </div>
  );
}

export function ServiceFiltersMobile(props: ServiceFiltersProps) {
  const { t } = useI18n();
  const { activeCount } = useUrlFilters();
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {t("common.filters")}
          {activeCount > 0 ? (
            <span className="ms-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="end" className="w-80 overflow-y-auto p-4">
        <SheetHeader className="mb-2">
          <SheetTitle className="text-start text-sm">{t("services.filters.title")}</SheetTitle>
        </SheetHeader>
        <ServiceFiltersPanel {...props} className="pb-20" />
        <div className="sticky bottom-0 -mx-4 border-t bg-background px-4 py-3">
          <Button className="w-full" onClick={() => setOpen(false)}>
            {t("common.apply")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
