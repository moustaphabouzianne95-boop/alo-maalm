import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RequestForm } from "@/components/requests/request-form";
import { SectionHeader } from "@/components/shared/section-header";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { CITIES, cityName } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { pickLocalized } from "@/lib/i18n/localize";
import { translate } from "@/lib/i18n/translate";
import { spOptionalString, type SearchParams } from "@/lib/utils/search-params";
import { listCategories } from "@/server/categories/service";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "requests.new.title") };
}

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard/requests/new");

  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const sp = await searchParams;

  if (session.user.role === "PROFESSIONAL") {
    return (
      <div className="space-y-4">
        <SectionHeader as="h1" size="lg" title={t("requests.new.title")} description={t("common.forbidden")} />
        <Button asChild variant="outline">
          <Link href="/professional">{t("nav.proArea")}</Link>
        </Button>
      </div>
    );
  }

  const { items: categories } = await listCategories({ activeOnly: true, withCounts: false, perPage: 50 });
  const cities = CITIES.map((city) => ({ slug: city.slug, name: cityName(city.slug, locale) }));

  let serviceId: string | null = null;
  const defaults: {
    title?: string;
    categoryId?: string;
    city?: string;
  } = {
    city: session.user.customer?.defaultCity ?? session.user.city ?? "",
  };

  const rawServiceId = spOptionalString(sp.serviceId);
  if (rawServiceId) {
    const service = await prisma.service.findFirst({
      where: { id: rawServiceId, status: "PUBLISHED" },
      select: { id: true, title: true, categoryId: true, city: true },
    });
    if (service) {
      serviceId = service.id;
      defaults.title = service.title;
      defaults.categoryId = service.categoryId;
      defaults.city = service.city;
    }
  } else {
    const professionalId = spOptionalString(sp.professionalId);
    if (professionalId) {
      const profile = await prisma.professionalProfile.findUnique({
        where: { id: professionalId },
        select: {
          city: true,
          services: { where: { status: "PUBLISHED" }, take: 1, select: { categoryId: true } },
        },
      });
      if (profile) {
        defaults.city = profile.city;
        if (profile.services[0]) defaults.categoryId = profile.services[0].categoryId;
      }
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SectionHeader as="h1" size="lg" title={t("requests.new.title")} description={t("requests.new.subtitle")} />
      <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <RequestForm
          mode="create"
          serviceId={serviceId}
          categories={categories.map((category) => ({ id: category.id, name: pickLocalized(category, locale) }))}
          cities={cities}
          defaults={defaults}
        />
      </div>
    </div>
  );
}
