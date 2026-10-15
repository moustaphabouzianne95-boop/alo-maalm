import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RequestForm } from "@/components/requests/request-form";
import { SectionHeader } from "@/components/shared/section-header";
import { Button } from "@/components/ui/button";
import { loadOrNull } from "@/lib/api/or-not-found";
import { getSession } from "@/lib/auth/session";
import { CITIES, cityName } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { pickLocalized } from "@/lib/i18n/localize";
import { translate } from "@/lib/i18n/translate";
import { OFFERABLE_STATUSES, getRequest } from "@/server/requests/service";
import { listCategories } from "@/server/categories/service";

interface Props {
  params: Promise<{ id: string }>;
}

function asDateInput(value: Date | null): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "requests.form.update") };
}

export default async function EditRequestPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard/requests");
  const { id } = await params;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const request = await loadOrNull(getRequest(session.user, id));
  if (!request) notFound();

  const editable =
    request.customerId === session.user.id &&
    OFFERABLE_STATUSES.includes(request.status) &&
    request.offersCount === 0;

  if (!editable) {
    return (
      <div className="space-y-4">
        <SectionHeader as="h1" size="lg" title={t("requests.form.update")} description={t("requests.browse.closed")} />
        <Button asChild variant="outline">
          <Link href={`/dashboard/requests/${id}`}>{t("common.back")}</Link>
        </Button>
      </div>
    );
  }

  const { items: categories } = await listCategories({ activeOnly: true, withCounts: false, perPage: 50 });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SectionHeader as="h1" size="lg" title={t("requests.form.update")} description={request.reference} />
      <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <RequestForm
          mode="edit"
          requestId={request.id}
          categories={categories.map((category) => ({ id: category.id, name: pickLocalized(category, locale) }))}
          cities={CITIES.map((city) => ({ slug: city.slug, name: cityName(city.slug, locale) }))}
          defaults={{
            title: request.title,
            categoryId: request.categoryId,
            description: request.description,
            city: request.city,
            neighborhood: request.neighborhood ?? "",
            address: request.address ?? "",
            budgetMin: request.budgetMin,
            budgetMax: request.budgetMax,
            preferredDate: asDateInput(request.preferredDate),
            preferredTime: request.preferredTime ?? "",
            urgency: request.urgency,
          }}
        />
      </div>
    </div>
  );
}
