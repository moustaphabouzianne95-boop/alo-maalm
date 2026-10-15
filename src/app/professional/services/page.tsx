import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Wrench } from "lucide-react";
import type { ServiceStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { UrlSearch } from "@/components/dashboard/url-search";
import { ServiceActions } from "@/components/professional/service-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { OptionSelect } from "@/components/shared/filter-controls";
import { Pagination } from "@/components/shared/pagination";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { getSession } from "@/lib/auth/session";
import { cityName, formatMoney } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { pickLocalized } from "@/lib/i18n/localize";
import { translate } from "@/lib/i18n/translate";
import { buildPageHref, spOptionalString, spPage, spString, type SearchParams } from "@/lib/utils/search-params";
import { listOwnServices } from "@/server/services/service";

const STATUSES = ["DRAFT", "PUBLISHED", "PAUSED", "HIDDEN"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "pro.services.title") };
}

export default async function ProfessionalServicesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/professional/services");
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const statusRaw = spString(sp.status);
  const status = (STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as ServiceStatus) : undefined;
  const result = await listOwnServices(session.user.id, {
    status,
    search: spOptionalString(sp.search),
    page: spPage(sp.page),
    perPage: 12,
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        size="lg"
        title={t("pro.services.title")}
        action={
          <Button asChild>
            <Link href="/professional/services/new">
              <Plus className="h-4 w-4" aria-hidden />
              {t("common.create")}
            </Link>
          </Button>
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <UrlSearch placeholder={t("services.search.placeholder")} className="sm:max-w-xs sm:flex-1" />
        <div className="sm:w-48">
          <OptionSelect
            label={t("common.status")}
            param="status"
            allLabel={t("common.all")}
            options={STATUSES.map((value) => ({ value, label: t(`services.status.${value}`) }))}
          />
        </div>
      </div>
      {result.items.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-6 w-6" />}
          title={t("pro.services.empty.title")}
          description={t("pro.services.empty.body")}
          action={
            <Button asChild>
              <Link href="/professional/services/new">{t("pro.services.empty.cta")}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {result.items.map((service) => (
            <li key={service.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold">{pickLocalized(service, locale, "title")}</h2>
                    <StatusBadge domain="service" value={service.status} label={t(`services.status.${service.status}`)} size="sm" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pickLocalized(service.category, locale)} · {cityName(service.city, locale)} · {formatMoney(service.priceMin, { locale })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/professional/services/${service.id}/edit`}>{t("common.edit")}</Link>
                  </Button>
                  {service.status === "PUBLISHED" && (
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/services/${service.slug}`}>{t("common.viewDetails")}</Link>
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <ServiceActions id={service.id} status={service.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        perPage={result.perPage}
        locale={locale}
        hrefFor={(next) => buildPageHref("/professional/services", sp, next)}
      />
    </div>
  );
}
