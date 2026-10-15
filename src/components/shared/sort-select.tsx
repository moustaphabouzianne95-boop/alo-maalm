"use client";

import { ArrowUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/provider";
import { useUrlFilters } from "./use-url-filters";
import { cn } from "@/lib/utils";

interface SortSelectProps {
  value: string;
  options: { value: string; label: string }[];
  className?: string;
}

/** Sort dropdown that writes `?sort=` into the URL (shared by all list pages). */
export function SortSelect({ value, options, className }: SortSelectProps) {
  const { apply } = useUrlFilters();
  const { t } = useI18n();

  return (
    <Select value={value} onValueChange={(next) => apply({ sort: next })}>
      <SelectTrigger
        className={cn("h-9 w-auto min-w-40 gap-1.5 border-input text-xs shadow-sm", className)}
        aria-label={t("common.sortBy")}
      >
        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-xs">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
