import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import { ReviewForm } from "@/components/reviews/review-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { RatingStars } from "@/components/shared/rating-stars";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatDateServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { buildPageHref, spPage, type SearchParams } from "@/lib/utils/search-params";
import { listMyReviews, reviewableBookings } from "@/server/reviews/service";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: translate(locale, "reviews.page.title") };
}

function subScore(value: unknown): { punctuality?: number; quality?: number; communication?: number } {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>;
  const num = (key: string) => (typeof row[key] === "number" ? (row[key] as number) : undefined);
  return { punctuality: num("punctuality"), quality: num("quality"), communication: num("communication") };
}

export default async function CustomerReviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard/reviews");
  const sp = await searchParams;
  const locale = await getLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const page = spPage(sp.page);
  const [reviews, pending] = await Promise.all([
    listMyReviews(session.user.id, { page, perPage: 10 }),
    reviewableBookings(session.user.id),
  ]);

  return (
    <div className="space-y-8">
      <SectionHeader as="h1" size="lg" title={t("reviews.page.title")} description={t("reviews.pending.body")} />

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">{t("reviews.pending.title")}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {pending.map((booking) => {
              const name =
                booking.professional.professionalProfile?.businessName?.trim() ||
                booking.professional.identity?.fullName ||
                "—";
              return (
                <article key={booking.id} id={`booking-${booking.id}`} className="rounded-xl border bg-card p-4 shadow-sm">
                  <p className="text-sm font-semibold">{booking.request?.title ?? name}</p>
                  <p className="mb-3 text-xs text-muted-foreground">{t("bookings.with", { name })}</p>
                  <ReviewForm mode="create" bookingId={booking.id} />
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("reviews.yours")}</h2>
        {reviews.items.length === 0 ? (
          <EmptyState icon={<Star className="h-6 w-6" />} title={t("reviews.empty.customer.title")} description={t("reviews.empty.customer.body")} />
        ) : (
          <ul className="space-y-3">
            {reviews.items.map((review) => {
              const name = review.professional.businessName?.trim() || review.professional.user.identity?.fullName || "—";
              const editable = review.editableUntil ? review.editableUntil.getTime() > Date.now() : false;
              return (
                <li key={review.id} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{review.booking.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {name}
                        {review.professional.slug && (
                          <>
                            {" · "}
                            <Link href={`/professionals/${review.professional.slug}`} className="hover:text-foreground">
                              {t("professionals.card.viewProfile")}
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                    <StatusBadge domain="review" value={review.status} label={t(`reviews.status.${review.status}`)} size="sm" />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <RatingStars value={review.rating} />
                    <span className="text-xs text-muted-foreground">{formatDateServer(review.createdAt, locale)}</span>
                  </div>
                  {review.comment && <p className="mt-2 whitespace-pre-wrap text-sm">{review.comment}</p>}
                  {review.reply && (
                    <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">
                      <span className="font-medium">{t("reviews.reply")}: </span>
                      {review.reply}
                    </p>
                  )}
                  {editable ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-medium text-primary">{t("reviews.form.update")}</summary>
                      <p className="mb-2 mt-1 text-xs text-muted-foreground">
                        {t("reviews.editWindow", { date: formatDateServer(review.editableUntil, locale) })}
                      </p>
                      <ReviewForm
                        mode="edit"
                        reviewId={review.id}
                        initialRating={review.rating}
                        initialComment={review.comment ?? ""}
                        initialSub={subScore(review.subRatings)}
                      />
                    </details>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">{t("reviews.locked")}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Pagination
          page={reviews.page}
          totalPages={reviews.totalPages}
          total={reviews.total}
          perPage={reviews.perPage}
          locale={locale}
          hrefFor={(next) => buildPageHref("/dashboard/reviews", sp, next)}
        />
      </section>
    </div>
  );
}
