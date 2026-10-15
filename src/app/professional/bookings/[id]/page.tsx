import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MapPin, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProBookingActions } from "@/components/professional/pro-booking-actions";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { loadOrNull } from "@/lib/api/or-not-found";
import { getSession } from "@/lib/auth/session";
import { cityName, formatMoney } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
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
  const booking = await loadOrNull(getBooking(session.user, id));
  return { title: booking ? `${booking.reference} · ${booking.title}` : translate(locale, "bookings.page.title") };
}

export default async function ProfessionalBookingPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login?next=/professional/bookings");
  const { id } = await params;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  const booking = await loadOrNull(getBooking(session.user, id));
  if (!booking) notFound();
  const conversation = await getBookingConversation(booking.id, session.user.id);
  const customer = booking.customer.identity;
  const customerName = customer?.fullName || customer?.firstName || t("user.role.CUSTOMER");

  return (
    <div className="space-y-6">
      <div className="text-xs text-muted-foreground">
        <Link href="/professional/bookings" className="hover:text-foreground">
          {t("bookings.page.title")}
        </Link>
        <span aria-hidden> / </span>
        <span className="tabular-nums">{booking.reference}</span>
      </div>
      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeader as="h1" size="md" title={booking.title} description={booking.reference} />
          <StatusBadge domain="booking" value={booking.status} label={t(`bookings.status.${booking.status}`)} />
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">{t("user.role.CUSTOMER")}</dt>
            <dd className="font-medium">{customerName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("common.date")}</dt>
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
            <dt className="text-xs text-muted-foreground">{t("bookings.paymentStatus")}</dt>
            <dd>
              <StatusBadge domain="payment" value={booking.paymentStatus} label={t(`bookings.payment.${booking.paymentStatus}`)} size="sm" />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("bookings.duration")}</dt>
            <dd>{formatDurationServer(booking.durationMin, locale)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">{t("bookings.address")}</dt>
            <dd className="inline-flex items-start gap-1">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                {booking.address}
                {booking.neighborhood ? ` · ${booking.neighborhood}` : ""} · {cityName(booking.city, locale)}
              </span>
            </dd>
          </div>
        </dl>
        {booking.notes && <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{booking.notes}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <ProBookingActions bookingId={booking.id} status={booking.status} />
          {conversation && (
            <Button variant="outline" asChild>
              <Link href={`/professional/messages/${conversation.id}`}>
                <MessageSquare className="h-4 w-4" aria-hidden />
                {t("bookings.message")}
              </Link>
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
