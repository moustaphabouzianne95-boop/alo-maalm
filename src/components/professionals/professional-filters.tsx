"use client";

import * as React from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface ProfessionalFiltersProps {
  categories: FilterOption[];
  cities: FilterOption[];
  availability: FilterOption[];
  className?: string;
}

export function ProfessionalFiltersPanel({
  categories,
  cities,
  availability,
  className,
}: ProfessionalFiltersProps) {
  const { t } = useI18n();
  const [search, setSearch] = useDebouncedParam("search");

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("common.filters")}</h2>
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
          placeholder={t("professionals.search.placeholder")}
          aria-label={t("professionals.search.placeholder")}
          className="h-9 ps-8 text-xs"
          maxLength={120}
        />
      </div>

      <OptionSelect label={t("common.category")} param="category" options={categories} />
      <OptionSelect label={t("common.city")} param="city" options={cities} />
      <OptionSelect label={t("common.availability")} param="availability" options={availability} />
      <RatingSelect label={t("services.filters.minRating")} />

      <div className="space-y-2.5 border-t pt-4">
        <CheckboxFilter param="verified" label={t("common.verifiedOnly")} />
      </div>
    </div>
  );
}

export function ProfessionalFiltersDesktop(props: ProfessionalFiltersProps) {
  return (
    <div className="sticky top-20 rounded-xl border bg-card p-4 shadow-sm">
      <ProfessionalFiltersPanel {...props} />
    </div>
  );
}

export function ProfessionalFiltersMobile(props: ProfessionalFiltersProps) {
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
          <SheetTitle className="text-start text-sm">{t("common.filters")}</SheetTitle>
        </SheetHeader>
        <ProfessionalFiltersPanel {...props} className="pb-20" />
        <div className="sticky bottom-0 -mx-4 border-t bg-background px-4 py-3">
          <Button className="w-full" onClick={() => setOpen(false)}>
            {t("common.apply")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
