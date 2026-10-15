import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, SearchX } from "lucide-react";
import type { RequestStatus, Urgency } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { UrlSearch } from "@/components/dashboard/url-search";
import { RequestCard } from "@/components/requests/request-card";
import { EmptyState } from "@/components/shared/empty-state";
import { OptionSelect } from "@/components/shared/filter-controls";
import { Pagination } from "@/components/shared/pagination";
import { SectionHeader } from "@/components/shared/section-header";
import { SortSelect } from "@/components/shared/sort-select";
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";
import { buildPageHref, spEnum, spOptionalString, spPage, spString, type SearchParams } from "@/lib/utils/search-params";
import { listRequests } from "@/server/requests/service";

const STATUSES = ["OPEN", "RECEIVING_OFFERS", "OFFER_SELECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "EXPIRED"] as const;
const URGENCIES = ["NORMAL", "URGENT", "EMERGENCY"] as const;
const SORTS = ["newest", "budget_desc", "urgency", "offers"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "requests.page.title") };
}

export default async function CustomerRequestsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard/requests");

  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const statusRaw = spString(sp.status);
  const urgencyRaw = spString(sp.urgency);
  const status = (STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as RequestStatus) : undefined;
  const urgency = (URGENCIES as readonly string[]).includes(urgencyRaw) ? (urgencyRaw as Urgency) : undefined;
  const sort = spEnum(sp.sort, SORTS, "newest");
  const page = spPage(sp.page);

  const result = await listRequests({
    scope: "customer",
    actorId: session.user.id,
    status,
    urgency,
    search: spOptionalString(sp.search),
    sort,
    page,
    perPage: 10,
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        size="lg"
        title={t("requests.page.title")}
        description={t("requests.new.subtitle")}
        action={
          <Button asChild>
            <Link href="/dashboard/requests/new">
              <Plus className="h-4 w-4" aria-hidden />
              {t("nav.postRequest")}
            </Link>
          </Button>
        }
      />

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
        <SortSelect
          value={sort}
          options={[
            { value: "newest", label: t("common.sort.newest") },
            { value: "budget_desc", label: t("requests.sort.budget") },
            { value: "urgency", label: t("requests.sort.urgency") },
            { value: "offers", label: t("requests.sort.offers") },
          ]}
        />
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-6 w-6" />}
          title={t("requests.empty.customer.title")}
          description={t("requests.empty.customer.body")}
          action={
            <Button asChild>
              <Link href="/dashboard/requests/new">{t("requests.empty.customer.cta")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {result.items.map((request) => (
            <RequestCard key={request.id} request={request} locale={locale} />
          ))}
        </div>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        perPage={result.perPage}
        locale={locale}
        hrefFor={(next) => buildPageHref("/dashboard/requests", sp, next)}
      />
    </div>
  );
}
