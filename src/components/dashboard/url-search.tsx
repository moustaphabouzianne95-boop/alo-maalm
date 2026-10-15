"use client";

import { SearchInput } from "@/components/shared/search-input";
import { useDebouncedParam } from "@/components/shared/use-url-filters";
import { useI18n } from "@/lib/i18n/provider";

/** Debounced search box that persists `?search=` (§8, reused by every dashboard list). */
export function UrlSearch({ placeholder, className }: { placeholder: string; className?: string }) {
  const { t } = useI18n();
  const [value, setValue] = useDebouncedParam("search");
  return (
    <SearchInput
      value={value}
      onChange={setValue}
      placeholder={placeholder}
      ariaLabel={t("common.search")}
      className={className}
    />
  );
}
