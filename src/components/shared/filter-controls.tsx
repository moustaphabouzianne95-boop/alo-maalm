"use client";

import { X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/provider";
import { useUrlFilters } from "./use-url-filters";

export const ALL = "all";

export interface FilterOption {
  value: string;
  label: string;
}

/** Removes every filter param and returns to the bare path. */
export function ClearFiltersButton() {
  const { t } = useI18n();
  const { clearAll, activeCount } = useUrlFilters();
  if (activeCount === 0) return null;
  return (
    <button
      type="button"
      onClick={clearAll}
      className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
    >
      <X className="h-3 w-3" aria-hidden />
      {t("common.clearFilters")}
    </button>
  );
}

/**
 * Select bound to one URL param. Radix forbids an empty item value, so `all`
 * is the sentinel that deletes the param.
 */
export function OptionSelect({
  label,
  param,
  options,
  allLabel,
}: {
  label: string;
  param: string;
  options: FilterOption[];
  allLabel?: string;
}) {
  const { apply, get } = useUrlFilters();
  const value = get(param) || ALL;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={(next) => apply({ [param]: next === ALL ? null : next })}>
        <SelectTrigger className="h-9 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel ?? label}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="text-xs">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Star threshold select (`?minRating=`). */
export function RatingSelect({ label }: { label: string }) {
  const { t } = useI18n();
  return (
    <OptionSelect
      label={label}
      param="minRating"
      allLabel={t("common.all")}
      options={[
        { value: "3", label: "★ 3+" },
        { value: "4", label: "★ 4+" },
        { value: "4.5", label: "★ 4.5+" },
      ]}
    />
  );
}

/** Checkbox bound to `?param=1`. */
export function CheckboxFilter({ param, label }: { param: string; label: string }) {
  const { apply, get } = useUrlFilters();
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs">
      <Checkbox checked={get(param) === "1"} onCheckedChange={(checked) => apply({ [param]: checked ? "1" : null })} />
      {label}
    </label>
  );
}
