import type { Metadata } from "next";
import Link from "next/link";
import type { ReviewStatus } from "@prisma/client";
import { ReviewModeration } from "@/components/admin/moderation-actions";
import { UrlSearch } from "@/components/dashboard/url-search";
import { OptionSelect } from "@/components/shared/filter-controls";
import { Pagination } from "@/components/shared/pagination";
import { RatingStars } from "@/components/shared/rating-stars";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatDateServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { buildPageHref, spOptionalString, spPage, spString, type SearchParams } from "@/lib/utils/search-params";
import { listAdminReviews } from "@/server/admin/lists";

const STATUSES = ["PUBLISHED", "HIDDEN", "UNDER_REVIEW"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "admin.reviews") };
}

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const statusRaw = spString(sp.status);
  const result = await listAdminReviews({
    status: (STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as ReviewStatus) : undefined,
    search: spOptionalString(sp.search),
    page: spPage(sp.page),
    perPage: 12,
  });

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" size="lg" title={t("admin.reviews")} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <UrlSearch placeholder={t("common.search")} className="sm:max-w-xs sm:flex-1" />
        <div className="sm:w-52">
          <OptionSelect label={t("common.status")} param="status" allLabel={t("common.all")} options={STATUSES.map((value) => ({ value, label: t(`reviews.status.${value}`) }))} />
        </div>
      </div>
      <ul className="space-y-3">
        {result.items.length === 0 && <li className="text-sm text-muted-foreground">{t("admin.empty.generic")}</li>}
        {result.items.map((review) => (
          <li key={review.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{review.booking.title}</p>
                <p className="text-xs text-muted-foreground">
                  {review.author.identity?.fullName} →{" "}
                  <Link href={`/admin/users/${review.professional.userId}`} className="hover:text-foreground">
                    {review.professional.businessName}
                  </Link>
                  {" · "}
                  {formatDateServer(review.createdAt, locale)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <RatingStars value={Number(review.rating)} />
                <StatusBadge domain="review" value={review.status} label={t(`reviews.status.${review.status}`)} size="sm" />
              </div>
            </div>
            {review.comment && <p className="mt-2 line-clamp-3 text-sm">{review.comment}</p>}
            <div className="mt-3">
              <ReviewModeration id={review.id} status={review.status} />
            </div>
          </li>
        ))}
      </ul>
      <Pagination page={result.page} totalPages={result.totalPages} total={result.total} perPage={result.perPage} locale={locale} hrefFor={(next) => buildPageHref("/admin/reviews", sp, next)} />
    </div>
  );
}
