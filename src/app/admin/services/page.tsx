import type { Metadata } from "next";
import Link from "next/link";
import type { ServiceStatus } from "@prisma/client";
import { ServiceModeration } from "@/components/admin/moderation-actions";
import { UrlSearch } from "@/components/dashboard/url-search";
import { OptionSelect } from "@/components/shared/filter-controls";
import { Pagination } from "@/components/shared/pagination";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";
import { buildPageHref, spOptionalString, spPage, spString, type SearchParams } from "@/lib/utils/search-params";
import { listAdminServices } from "@/server/admin/lists";

const STATUSES = ["PUBLISHED", "DRAFT", "PAUSED", "HIDDEN"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "admin.services") };
}

export default async function AdminServicesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const statusRaw = spString(sp.status);
  const result = await listAdminServices({
    status: (STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as ServiceStatus) : undefined,
    category: spOptionalString(sp.category),
    search: spOptionalString(sp.search),
    page: spPage(sp.page),
    perPage: 15,
  });

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" size="lg" title={t("admin.services")} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <UrlSearch placeholder={t("common.search")} className="sm:max-w-xs sm:flex-1" />
        <div className="sm:w-52">
          <OptionSelect label={t("common.status")} param="status" allLabel={t("common.all")} options={STATUSES.map((value) => ({ value, label: t(`services.status.${value}`) }))} />
        </div>
      </div>
      <ul className="space-y-3">
        {result.items.length === 0 && <li className="text-sm text-muted-foreground">{t("admin.empty.generic")}</li>}
        {result.items.map((service) => (
          <li key={service.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold">{service.title}</h2>
                  <StatusBadge domain="service" value={service.status} label={t(`services.status.${service.status}`)} size="sm" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {service.category.name} · {formatMoney(service.priceMin, { locale })} ·{" "}
                  <Link href={`/admin/users/${service.professional.user.id}`} className="hover:text-foreground">
                    {service.professional.businessName || service.professional.user.identity?.fullName}
                  </Link>
                </p>
              </div>
              {service.status === "PUBLISHED" && (
                <Link href={`/services/${service.slug}`} className="text-xs font-medium text-primary">
                  {t("common.viewDetails")}
                </Link>
              )}
            </div>
            <div className="mt-3">
              <ServiceModeration id={service.id} status={service.status} />
            </div>
          </li>
        ))}
      </ul>
      <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={result.perPage} locale={locale} hrefFor={(next) => buildPageHref("/admin/services", sp, next)} />
    </div>
  );
}
