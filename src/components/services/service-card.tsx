import Link from "next/link";
import type { PricingType } from "@prisma/client";
import { ArrowRight, BadgeCheck, Flame, MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RatingStars } from "@/components/shared/rating-stars";
import { CategoryIcon } from "@/components/icons/category-icon";
import { cityName, formatMoney } from "@/lib/constants/morocco";
import { pickLocalized } from "@/lib/i18n/localize";
import { formatNumberServer, formatRatingServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import type { LangCode } from "@/lib/i18n/config";
import { cn, initialsOf } from "@/lib/utils";
import type { ServiceCardRow } from "@/server/services/service";

interface ServiceCardProps {
  service: ServiceCardRow;
  locale: LangCode;
  className?: string;
}

/** Price line for a service — shared by the card and the detail page. */
export function servicePriceLabel(
  service: { pricingType: PricingType; priceMin: number; priceMax?: number | null },
  locale: LangCode
): string {
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const money = formatMoney(service.priceMin, { locale });
  switch (service.pricingType) {
    case "CUSTOM_QUOTE":
      return t("services.pricing.CUSTOM_QUOTE");
    case "HOURLY":
      return `${money} · ${t("services.pricing.HOURLY")}`;
    case "FIXED":
      return money;
    case "STARTING_FROM":
    default:
      return t("services.card.startingFrom", { price: money });
  }
}

/**
 * Catalogue card (§8).
 *
 * Seeded services have no photography yet, so the cover falls back to a
 * category-tinted panel with the trade icon — a deliberate placeholder rather
 * than a broken `img`.
 */
export function ServiceCard({ service, locale, className }: ServiceCardProps) {
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const title = pickLocalized(service, locale, "title");
  const categoryName = pickLocalized(service.category, locale);
  const professionalName =
    service.professional.businessName?.trim() ||
    service.professional.user.identity?.fullName?.trim() ||
    "—";
  const verified = service.professional.verificationStatus === "VERIFIED";
  const cover = service.images[0]?.url ?? null;
  const tint = service.category.color ?? "#0f6b48";

  return (
    <Link
      href={`/services/${service.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card",
        className
      )}
    >
      <div
        className="relative h-32 w-full overflow-hidden"
        style={cover ? undefined : { background: `linear-gradient(135deg, ${tint}1f, ${tint}0a)` }}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- user uploads are served from our own storage route
          <img
            src={cover}
            alt={service.images[0]?.alt ?? title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <CategoryIcon name={service.category.icon} className="h-9 w-9" />
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-[11px] font-medium shadow-sm backdrop-blur">
            <CategoryIcon name={service.category.icon} className="h-3 w-3" />
            <span className="max-w-32 truncate">{categoryName}</span>
          </span>
          {service.isUrgentAvailable ? (
            <Badge variant="warning" className="gap-1 shadow-sm">
              <Flame className="h-3 w-3" aria-hidden />
              {t("requests.urgency.URGENT")}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-6 transition-colors group-hover:text-primary">
          {title}
        </h3>

        <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {cityName(service.city, locale)}
            {service.neighborhood ? ` · ${service.neighborhood}` : ""}
          </span>
        </p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RatingStars value={Number(service.ratingAverage)} size={13} />
            <span dir="ltr">
              {service.ratingCount > 0
                ? `${formatRatingServer(Number(service.ratingAverage), locale)} (${formatNumberServer(service.ratingCount, locale)})`
                : t("reviews.noneYet")}
            </span>
          </span>
        </div>

          <div className="mt-3 flex items-end justify-between gap-2 border-t pt-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-primary">{servicePriceLabel(service, locale)}</p>
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
              <Avatar className="h-4 w-4">
                <AvatarImage src={service.professional.avatarUrl ?? undefined} alt={professionalName} />
                <AvatarFallback className="bg-muted text-[8px]">{initialsOf(professionalName)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{professionalName}</span>
              {verified ? <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden /> : null}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
            {t("services.card.viewService")}
            <ArrowRight className="h-3.5 w-3.5 flip-rtl" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}
