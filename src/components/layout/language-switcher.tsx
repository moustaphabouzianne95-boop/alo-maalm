"use client";

import * as React from "react";
import { Check, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/provider";
import { LOCALES, LOCALE_LABELS, type LangCode } from "@/lib/i18n/config";

/**
 * Language switcher (§7).
 *
 * Switching writes the locale cookie, flips `<html lang/dir>` for client-rendered
 * parts, then re-requests the current URL with `?lang=` so server components
 * re-render in the new language without a full navigation.
 */
export function LanguageSwitcher({ variant = "ghost" }: { variant?: "ghost" | "outline" | "compact" }) {
  const { locale, setLocale } = useI18n();
  const [pending, setPending] = React.useState<LangCode | null>(null);

  const choose = React.useCallback(
    (next: LangCode) => {
      if (next === locale) return;
      setPending(next);
      setLocale(next);
      // `setLocale` triggers a router refresh; clear the spinner shortly after.
      window.setTimeout(() => setPending(null), 1200);
    },
    [locale, setLocale]
  );

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-1 rounded-lg border bg-card p-1" role="group" aria-label="Language">
        {LOCALES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => choose(code)}
            disabled={pending !== null}
            aria-pressed={locale === code}
            className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${
              locale === code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {LOCALE_LABELS[code].label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" className="gap-2" disabled={pending !== null}>
          <Globe className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{LOCALE_LABELS[locale].native}</span>
          <span className="sm:hidden">{LOCALE_LABELS[locale].label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {LOCALES.map((code) => (
          <DropdownMenuItem key={code} onSelect={() => choose(code)} className="gap-2">
            <span className="flex-1">{LOCALE_LABELS[code].native}</span>
            <span className="text-xs text-muted-foreground">{LOCALE_LABELS[code].label}</span>
            {locale === code ? <Check className="h-4 w-4 text-primary" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
