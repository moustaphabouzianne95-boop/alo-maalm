import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ServiceForm } from "@/components/professional/service-form";
import { SectionHeader } from "@/components/shared/section-header";
import { getSession } from "@/lib/auth/session";
import { CITIES, cityName } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { pickLocalized } from "@/lib/i18n/localize";
import { translate } from "@/lib/i18n/translate";
import { listCategories } from "@/server/categories/service";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "services.form.create.title") };
}

export default async function NewServicePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/professional/services/new");
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const { items } = await listCategories({ activeOnly: true, withCounts: false, perPage: 50 });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SectionHeader as="h1" size="lg" title={t("services.form.create.title")} description={t("services.form.create.subtitle")} />
      <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <ServiceForm
          mode="create"
          categories={items.map((category) => ({ id: category.id, name: pickLocalized(category, locale) }))}
          cities={CITIES.map((city) => ({ slug: city.slug, name: cityName(city.slug, locale) }))}
          defaults={{ city: session.user.professional?.city ?? session.user.city ?? "casablanca" }}
        />
      </div>
    </div>
  );
}
