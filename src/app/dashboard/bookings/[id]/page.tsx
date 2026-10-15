import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MessageSquare, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingActions } from "@/components/bookings/booking-actions";
import { ReviewForm } from "@/components/reviews/review-form";
import { RatingStars } from "@/components/shared/rating-stars";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { loadOrNull } from "@/lib/api/or-not-found";
import { getSession } from "@/lib/auth/session";
import { cityName, formatMoney } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { pickLocalized } from "@/lib/i18n/localize";
import { formatDateServer, formatDurationServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { getBooking, getBookingConversation } from "@/server/bookings/service";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await getLocale();
  const session = await getSession();
  const { id } = await params;
  if (!session) return { title: translate(locale, "bookings.page.title") };
  try {
    const booking = await getBooking(session.user, id);
    return { title: `${booking.reference} · ${booking.title}` };
  } catch {
    return { title: translate(locale, "bookings.notFound") };
  }
}

export default async function CustomerBookingDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard/bookings");
  const { id } = await params;
  const locale = await getLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const booking = await loadOrNull(getBooking(session.user, id));
  if (!booking) notFound();
  const conversation = await getBookingConversation(booking.id, session.user.id);
  const isCustomer = booking.customerId === session.user.id;
  const profile = booking.professional.professionalProfile;
  const proName = profile?.businessName?.trim() || booking.professional.identity?.fullName || "—";
  const canReview = isCustomer && booking.status === "COMPLETED" && !booking.review;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link href="/dashboard/bookings" className="hover:text-foreground">
          {t("bookings.page.title")}
        </Link>
        <span aria-hidden>/</span>
        <span className="tabular-nums">{booking.reference}</span>
      </div>

      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionHeader as="h1" size="md" title={booking.title} />
            <p className="mt-1 text-sm text-muted-foreground">{t("bookings.with", { name: proName })}</p>
          </div>
          <StatusBadge domain="booking" value={booking.status} label={t(`bookings.status.${booking.status}`)} />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <UserAvatar name={proName} src={profile?.avatarUrl} size="md" rounded="xl" />
          <div className="text-sm">
            {profile?.slug ? (
              <Link href={`/professionals/${profile.slug}`} className="font-medium hover:text-primary">
                {proName}
              </Link>
            ) : (
              <p className="font-medium">{proName}</p>
            )}
            <p className="text-xs text-muted-foreground">
              <MapPin className="me-1 inline h-3 w-3" aria-hidden />
              {cityName(booking.city, locale)}
              {booking.neighborhood ? ` · ${booking.neighborhood}` : ""}
            </p>
          </div>
        </div>

        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">{t("bookings.scheduledFor")}</dt>
            <dd>
              {formatDateServer(booking.scheduledDate, locale)}
              {booking.scheduledTime ? ` · ${booking.scheduledTime}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("bookings.price")}</dt>
            <dd className="font-semibold tabular-nums">{formatMoney(booking.price, { locale })}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("bookings.duration")}</dt>
            <dd>{formatDurationServer(booking.durationMin, locale)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("bookings.paymentStatus")}</dt>
            <dd>
              <StatusBadge domain="payment" value={booking.paymentStatus} label={t(`bookings.payment.${booking.paymentStatus}`)} size="sm" />
            </dd>
          </div>
        </dl>

        {isCustomer && booking.address && (
          <p className="mt-4 text-sm">
            <span className="text-muted-foreground">{t("bookings.address")}: </span>
            {booking.address}
          </p>
        )}
        {booking.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{booking.notes}</p>}
        {booking.request && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("requests.reference")}:{" "}
            <Link href={`/dashboard/requests/${booking.request.id}`} className="underline-offset-2 hover:underline">
              {booking.request.reference} · {booking.request.title}
            </Link>
            {booking.request.category ? ` · ${pickLocalized(booking.request.category, locale)}` : ""}
          </p>
        )}

        <p className="mt-4 text-xs text-muted-foreground">{t("bookings.paymentDisclaimer")}</p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {isCustomer && <BookingActions bookingId={booking.id} status={booking.status} />}
          {conversation && (
            <Button variant="outline" asChild>
              <Link href={`/dashboard/messages/${conversation.id}`}>
                <MessageSquare className="h-4 w-4" aria-hidden />
                {t("bookings.message")}
              </Link>
            </Button>
          )}
        </div>
      </section>

      {canReview && (
        <section id="review" className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <SectionHeader as="h2" size="sm" title={t("reviews.form.title")} description={t("reviews.form.subtitle")} />
          <div className="mt-4">
            <ReviewForm mode="create" bookingId={booking.id} />
          </div>
        </section>
      )}

      {booking.review && (
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <SectionHeader as="h2" size="sm" title={t("bookings.reviewed")} />
          <div className="mt-3 flex items-center gap-2">
            <RatingStars value={booking.review.rating} />
            <span className="text-sm font-medium">{booking.review.rating}/5</span>
          </div>
          {booking.review.comment && <p className="mt-2 whitespace-pre-wrap text-sm">{booking.review.comment}</p>}
          {booking.review.reply && (
            <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="font-medium">{t("reviews.reply")}: </span>
              {booking.review.reply}
            </p>
          )}
        </section>
      )}

      {booking.statusHistory.length > 0 && (
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <SectionHeader as="h2" size="sm" title={t("bookings.timeline")} />
          <ol className="mt-4 space-y-3">
            {booking.statusHistory.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 text-sm">
                <StatusBadge domain="booking" value={entry.to} label={t(`bookings.status.${entry.to}`)} size="sm" />
                <div>
                  <p className="text-xs text-muted-foreground">{formatDateServer(entry.createdAt, locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  {entry.reason && <p className="mt-0.5 text-xs">{entry.reason}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
