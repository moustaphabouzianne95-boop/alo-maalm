import Link from "next/link";
import { MapPin } from "lucide-react";
import { CategoryIcon } from "@/components/icons/category-icon";
import { StatusBadge } from "@/components/shared/status-badge";
import { cityName, formatMoneyRange } from "@/lib/constants/morocco";
import type { LangCode } from "@/lib/i18n/config";
import { pickLocalized } from "@/lib/i18n/localize";
import { formatDateServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import type { RequestListRow } from "@/server/requests/service";

/** Compact request row shared by the overview and the requests list. */
export function RequestCard({
  request,
  locale,
  hrefBase = "/dashboard/requests",
}: {
  request: RequestListRow;
  locale: LangCode;
  hrefBase?: string;
}) {
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const hasBudget = request.budgetMin != null || request.budgetMax != null;
  const offers = request._count.offers;

  return (
    <Link
      href={`${hrefBase}/${request.id}`}
      className="card-hover block rounded-xl border bg-card p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: request.category.color ?? "#0f6b48" }}
          aria-hidden
        >
          <CategoryIcon name={request.category.icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{request.title}</h3>
            <StatusBadge domain="request" value={request.status} label={t(`requests.status.${request.status}`)} size="sm" />
            {request.urgency !== "NORMAL" && (
              <StatusBadge domain="urgency" value={request.urgency} label={t(`requests.urgency.${request.urgency}`)} size="sm" />
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{pickLocalized(request.category, locale)}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden />
              {cityName(request.city, locale)}
            </span>
            <span className="tabular-nums">{request.reference}</span>
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">
          {hasBudget ? formatMoneyRange(request.budgetMin, request.budgetMax, { locale }) : t("services.pricing.CUSTOM_QUOTE")}
        </span>
        <span className="text-muted-foreground">
          {t("requests.offersCount", { count: offers })}
          {" · "}
          {formatDateServer(request.createdAt, locale)}
        </span>
      </div>
    </Link>
  );
}
