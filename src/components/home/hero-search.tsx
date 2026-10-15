"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/provider";

const ALL_CITIES = "all";

interface HeroSearchProps {
  cities: { slug: string; name: string }[];
  defaultCity?: string | null;
}

/**
 * Hero search (§7): one field + one city picker that deep-links into the
 * services catalogue. The form never fetches by itself — it navigates, so the
 * result page owns the query, the filters and the URL state.
 */
export function HeroSearch({ cities, defaultCity }: HeroSearchProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [query, setQuery] = React.useState("");
  const [city, setCity] = React.useState<string>(defaultCity || ALL_CITIES);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    const search = query.trim();
    if (search) params.set("search", search);
    if (city && city !== ALL_CITIES) params.set("city", city);
    const qs = params.toString();
    router.push(qs ? `/services?${qs}` : "/services");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border bg-card p-3 shadow-card sm:p-4"
      role="search"
      aria-label={t("home.search.title")}
    >
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("home.search.placeholder")}
            aria-label={t("home.search.title")}
            className="h-12 ps-9 text-base"
            maxLength={120}
          />
        </div>

        <Select value={city} onValueChange={setCity}>
          <SelectTrigger
            className="h-12 text-base lg:w-60"
            aria-label={t("home.search.city")}
          >
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <SelectValue placeholder={t("home.search.city")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CITIES}>{t("common.all")}</SelectItem>
            {cities.map((option) => (
              <SelectItem key={option.slug} value={option.slug}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button type="submit" size="lg" className="h-12 shrink-0 px-8 text-base">
          <Search className="h-4 w-4" aria-hidden />
          {t("home.search.button")}
        </Button>
      </div>
    </form>
  );
}
