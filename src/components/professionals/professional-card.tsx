import Link from "next/link";
import { ArrowRight, BadgeCheck, Briefcase, Clock, MapPin, Medal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RatingStars } from "@/components/shared/rating-stars";
import { CategoryIcon } from "@/components/icons/category-icon";
import { cityName } from "@/lib/constants/morocco";
import { formatNumberServer, formatRatingServer, formatResponseTimeServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import type { LangCode } from "@/lib/i18n/config";
import { cn, initialsOf } from "@/lib/utils";
import type { ProfessionalCard as ProfessionalCardData } from "@/server/professionals/service";

interface ProfessionalCardProps {
  professional: ProfessionalCardData;
  locale: LangCode;
  className?: string;
}

function availabilityVariant(status: ProfessionalCardData["availabilityStatus"]) {
  if (status === "AVAILABLE") return "success" as const;
  if (status === "BUSY") return "warning" as const;
  return "muted" as const;
}

/**
 * Directory card used on the home page, `/professionals` and category pages.
 *
 * Deliberately shows no phone number or email: private contact details stay
 * behind the conversation flow (§51).
 */
export function ProfessionalCard({ professional, locale, className }: ProfessionalCardProps) {
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);

  const availabilityLabel =
    professional.availabilityStatus === "AVAILABLE"
      ? t("common.available")
      : professional.availabilityStatus === "BUSY"
        ? t("common.busy")
        : t("common.unavailable");

  return (
    <Link
      href={`/professionals/${professional.slug}`}
      className={cn(
        "group flex flex-col rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12 rounded-xl">
          <AvatarImage src={professional.avatarUrl ?? undefined} alt={professional.name} />
          <AvatarFallback className="rounded-xl bg-brand-50 font-semibold text-brand-700">
            {initialsOf(professional.name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold transition-colors group-hover:text-primary">
              {professional.name}
            </h3>
            {professional.verified ? (
              <BadgeCheck className="h-4 w-4 shrink-0 text-brand-600" aria-label={t("common.verified")} />
            ) : null}
          </div>
          {professional.headline ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{professional.headline}</p>
          ) : null}
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {cityName(professional.city, locale)}
              {professional.neighborhood ? ` · ${professional.neighborhood}` : ""}
            </span>
          </p>
        </div>

        <div className="shrink-0 text-end">
          <RatingStars value={professional.ratingAverage} />
          <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
            {formatRatingServer(professional.ratingAverage, locale)}
            <span className="opacity-70"> ({formatNumberServer(professional.ratingCount, locale)})</span>
          </p>
        </div>
      </div>

      {professional.categories.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {professional.categories.slice(0, 3).map((category) => (
            <span
              key={category.id}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground"
            >
              <CategoryIcon name={category.icon} className="h-3.5 w-3.5" />
              {category.name}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center">
        <div>
          <p className="text-sm font-semibold">{formatNumberServer(professional.completedJobs, locale)}</p>
          <p className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <Briefcase className="h-3 w-3" aria-hidden />
            {t("common.completedJobs")}
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold">{formatNumberServer(professional.yearsExperience, locale)}</p>
          <p className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <Medal className="h-3 w-3" aria-hidden />
            {t("common.experience")}
          </p>
        </div>
        <div>
          <p className="truncate text-sm font-semibold" title={formatResponseTimeServer(professional.responseTimeMin, locale)}>
            {professional.responseTimeMin > 0 ? formatNumberServer(professional.responseTimeMin, locale) : "—"}
          </p>
          <p className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden />
            {t("common.minutes")}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <Badge variant={availabilityVariant(professional.availabilityStatus)}>{availabilityLabel}</Badge>
        <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          {t("professionals.card.viewProfile")}
          <ArrowRight className="h-3.5 w-3.5 flip-rtl" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
