import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import { ReviewReplyForm } from "@/components/professional/review-reply-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { RatingStars } from "@/components/shared/rating-stars";
import { SectionHeader } from "@/components/shared/section-header";
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatDateServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { buildPageHref, spPage, type SearchParams } from "@/lib/utils/search-params";
import { listReviews } from "@/server/reviews/service";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "pro.reviews.title") };
}

export default async function ProfessionalReviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/professional/reviews");
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const result = await listReviews({
    professionalUserId: session.user.id,
    page: spPage(sp.page),
    perPage: 10,
  });

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" size="lg" title={t("pro.reviews.title")} />
      {result.items.length === 0 ? (
        <EmptyState icon={<Star className="h-6 w-6" />} title={t("reviews.empty.professional.title")} description={t("reviews.empty.professional.body")} />
      ) : (
        <ul className="space-y-3">
          {result.items.map((review) => (
            <li key={review.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{review.booking.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {review.author.identity?.firstName ?? t("user.role.CUSTOMER")} · {formatDateServer(review.createdAt, locale)}
                  </p>
                </div>
                <RatingStars value={Number(review.rating)} />
              </div>
              {review.comment && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{review.comment}</p>}
              {review.reply ? (
                <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">
                  <p className="text-xs font-semibold text-muted-foreground">{t("reviews.reply")}</p>
                  <p className="mt-1 whitespace-pre-wrap">{review.reply}</p>
                </div>
              ) : (
                <div className="mt-3">
                  <ReviewReplyForm reviewId={review.id} />
                </div>
              )}
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
        hrefFor={(next) => buildPageHref("/professional/reviews", sp, next)}
      />
    </div>
  );
}
