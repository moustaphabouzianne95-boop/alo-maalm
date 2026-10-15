import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  DeactivateAccountButton,
  NotificationSettingsForm,
  PasswordSettingsForm,
  ProfileSettingsForm,
} from "@/components/dashboard/settings-forms";
import { SectionHeader } from "@/components/shared/section-header";
import { getSession } from "@/lib/auth/session";
import { CITIES, cityName } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";
import { formatDateServer } from "@/lib/i18n/server-format";
import { getOwnAccount } from "@/server/users/service";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "settings.title") };
}

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard/settings");
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const account = await getOwnAccount(session.user.id);
  const identity = account.identity;
  const prefs = account.customerProfile;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <SectionHeader as="h1" size="lg" title={t("settings.title")} description={t("settings.subtitle")} />

      <section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold">{t("settings.sections.profile")}</h2>
        <p className="text-xs text-muted-foreground">
          {t("common.memberSince")} {formatDateServer(account.createdAt, locale)}
        </p>
        <ProfileSettingsForm
          email={account.email}
          cities={CITIES.map((city) => ({ slug: city.slug, name: cityName(city.slug, locale) }))}
          defaults={{
            firstName: identity?.firstName ?? "",
            lastName: identity?.lastName ?? "",
            phone: account.phone,
            city: identity?.city ?? "",
            address: identity?.address ?? "",
            bio: identity?.bio ?? "",
            locale: account.locale,
          }}
        />
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold">{t("settings.sections.security")}</h2>
        <PasswordSettingsForm />
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold">{t("settings.sections.notifications")}</h2>
        <NotificationSettingsForm
          defaults={{
            notifyByEmail: prefs?.notifyByEmail ?? true,
            notifyByPhone: prefs?.notifyByPhone ?? false,
            notifyByWhatsapp: prefs?.notifyByWhatsapp ?? false,
          }}
        />
      </section>

      <section className="space-y-3 rounded-xl border border-destructive/30 bg-card p-4 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-destructive">{t("settings.sections.danger")}</h2>
        <p className="text-sm text-muted-foreground">{t("settings.deactivate.body")}</p>
        <DeactivateAccountButton />
      </section>
    </div>
  );
}
