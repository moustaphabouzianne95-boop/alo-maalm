"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type FilterChanges = Record<string, string | number | null | undefined>;

/**
 * URL-persisted filter state (§8).
 *
 * The query string is the single source of truth: filters survive a refresh,
 * work with back/forward, and can be shared as a link. Changing a filter
 * resets `page` unless explicitly told otherwise.
 */
export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsString = searchParams.toString();

  const apply = useCallback(
    (changes: FilterChanges, opts?: { keepPage?: boolean }) => {
      const params = new URLSearchParams(paramsString);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === undefined || value === "") params.delete(key);
        else params.set(key, String(value));
      }
      if (!opts?.keepPage) params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [paramsString, pathname, router]
  );

  const clearAll = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const get = useCallback((key: string) => searchParams.get(key) ?? "", [searchParams]);

  const activeCount = Array.from(searchParams.entries()).filter(
    ([key, value]) => key !== "page" && value !== ""
  ).length;

  return { apply, clearAll, get, activeCount };
}

/**
 * Controlled input value that writes to a URL param after `delay` ms of
 * inactivity — the debounced search required by §8.
 */
export function useDebouncedParam(key: string, delay = 400) {
  const { apply, get } = useUrlFilters();
  const paramValue = get(key);
  const [value, setValue] = useState(paramValue);

  // External navigation (clear filters, back button) re-syncs the input.
  useEffect(() => {
    setValue(paramValue);
  }, [paramValue]);

  useEffect(() => {
    if (value === paramValue) return;
    const id = setTimeout(() => apply({ [key]: value }), delay);
    return () => clearTimeout(id);
  }, [value, paramValue, key, delay, apply]);

  return [value, setValue] as const;
}
