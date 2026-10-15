import type { Metadata } from "next";
import { ClearRateLimitsButton } from "@/components/admin/moderation-actions";
import { SectionHeader } from "@/components/shared/section-header";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "admin.settings") };
}

export default async function AdminSettingsPage() {
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SectionHeader as="h1" size="lg" title={t("admin.settings")} />
      <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold">{t("admin.rateLimit.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("admin.rateLimit.body")}</p>
        <ClearRateLimitsButton />
      </section>
    </div>
  );
}
