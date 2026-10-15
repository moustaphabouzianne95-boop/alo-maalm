import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ServiceForm } from "@/components/professional/service-form";
import { SectionHeader } from "@/components/shared/section-header";
import { loadOrNull } from "@/lib/api/or-not-found";
import { getSession } from "@/lib/auth/session";
import { CITIES, cityName } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { pickLocalized } from "@/lib/i18n/localize";
import { translate } from "@/lib/i18n/translate";
import { listCategories } from "@/server/categories/service";
import { getServiceForOwner } from "@/server/services/service";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "services.form.edit.title") };
}

export default async function EditServicePage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login?next=/professional/services");
  const { id } = await params;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const service = await loadOrNull(getServiceForOwner(session.user, id));
  if (!service) notFound();
  const { items } = await listCategories({ activeOnly: true, withCounts: false, perPage: 50 });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SectionHeader as="h1" size="lg" title={t("services.form.edit.title")} description={service.slug} />
      <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <ServiceForm
          mode="edit"
          serviceId={service.id}
          categories={items.map((category) => ({ id: category.id, name: pickLocalized(category, locale) }))}
          cities={CITIES.map((city) => ({ slug: city.slug, name: cityName(city.slug, locale) }))}
          defaults={{
            title: service.title,
            categoryId: service.categoryId,
            description: service.description,
            pricingType: service.pricingType,
            priceMin: service.priceMin,
            priceMax: service.priceMax,
            durationMin: service.durationMin,
            durationUnit: service.durationUnit as "HOUR" | "DAY" | "JOB" | "MINUTE",
            city: service.city,
            neighborhood: service.neighborhood ?? "",
            keywords: service.keywords,
            includes: service.includes,
            warrantyDays: service.warrantyDays,
            isUrgentAvailable: service.isUrgentAvailable,
            coverImage: service.coverImage,
            status: service.status,
          }}
        />
      </div>
    </div>
  );
}
