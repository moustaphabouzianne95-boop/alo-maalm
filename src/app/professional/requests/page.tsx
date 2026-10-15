import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import type { RequestStatus, Urgency } from "@prisma/client";
import { UrlSearch } from "@/components/dashboard/url-search";
import { RequestCard } from "@/components/requests/request-card";
import { CheckboxFilter, OptionSelect } from "@/components/shared/filter-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { SectionHeader } from "@/components/shared/section-header";
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";
import { buildPageHref, spBool, spOptionalString, spPage, spString, type SearchParams } from "@/lib/utils/search-params";
import { listRequests } from "@/server/requests/service";

const STATUSES = ["OPEN", "RECEIVING_OFFERS", "OFFER_SELECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "EXPIRED"] as const;
const URGENCIES = ["NORMAL", "URGENT", "EMERGENCY"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "pro.requests.title") };
}

export default async function ProfessionalRequestsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/professional/requests");
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const statusRaw = spString(sp.status);
  const urgencyRaw = spString(sp.urgency);
  const showAll = spBool(sp.all);
  const result = await listRequests({
    scope: "professional",
    actorId: session.user.id,
    matchedOnly: !showAll,
    status: (STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as RequestStatus) : undefined,
    urgency: (URGENCIES as readonly string[]).includes(urgencyRaw) ? (urgencyRaw as Urgency) : undefined,
    search: spOptionalString(sp.search),
    city: spOptionalString(sp.city),
    page: spPage(sp.page),
    perPage: 10,
    sort: "newest",
  });
  const offered = new Set(result.offeredRequestIds);

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" size="lg" title={t("pro.requests.title")} description={t("requests.browse.subtitle")} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <UrlSearch placeholder={t("common.search")} className="sm:max-w-xs sm:flex-1" />
        <div className="grid flex-1 grid-cols-2 gap-2 sm:max-w-md">
          <OptionSelect
            label={t("common.status")}
            param="status"
            allLabel={t("common.all")}
            options={STATUSES.map((value) => ({ value, label: t(`requests.status.${value}`) }))}
          />
          <OptionSelect
            label={t("requests.form.urgency")}
            param="urgency"
            allLabel={t("common.all")}
            options={URGENCIES.map((value) => ({ value, label: t(`requests.urgency.${value}`) }))}
          />
        </div>
        <CheckboxFilter param="all" label={t("pro.showAllRequests")} />
      </div>
      {result.items.length === 0 ? (
        <EmptyState icon={<Inbox className="h-6 w-6" />} title={t("requests.empty.professional.title")} description={t("requests.empty.professional.body")} />
      ) : (
        <div className="space-y-3">
          {result.items.map((request) => (
            <div key={request.id} className="space-y-1">
              <RequestCard request={request} locale={locale} hrefBase="/professional/requests" />
              {offered.has(request.id) && <p className="px-1 text-xs font-medium text-brand-700">{t("pro.alreadyOffered")}</p>}
            </div>
          ))}
        </div>
      )}
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        perPage={result.perPage}
        locale={locale}
        hrefFor={(next) => buildPageHref("/professional/requests", sp, next)}
      />
      <p className="text-xs text-muted-foreground">
        <Link href="/professional/services" className="underline-offset-2 hover:underline">
          {t("pro.matchedOnly")}
        </Link>
      </p>
    </div>
  );
}
