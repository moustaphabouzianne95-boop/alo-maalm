import type { ReactNode } from "react";
import { BrandLink } from "@/components/layout/brand-mark";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";

/**
 * Auth shell: brand, language switcher and a single centred card.
 * No marketplace chrome here — the visitor has exactly one decision to make.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);

  return (
    <div className="pattern-zellige flex min-h-dvh flex-col bg-gradient-to-b from-brand-50/60 to-background">
      <div className="page-shell flex items-center justify-between py-4">
        <BrandLink stacked name={t("brand.name")} tagline={t("brand.tagline")} />
        <LanguageSwitcher />
      </div>
      <div className="flex flex-1 items-start justify-center px-4 pb-20 pt-4 sm:items-center sm:pt-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
