import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { loadOrNull } from "@/lib/api/or-not-found";
import { getSession } from "@/lib/auth/session";
import { cityName, formatMoney } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { formatDateServer } from "@/lib/i18n/server-format";
import { translate } from "@/lib/i18n/translate";
import { getBooking } from "@/server/bookings/service";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await getLocale();
  const session = await getSession();
  const { id } = await params;
  if (!session) return { title: translate(locale, "admin.bookings") };
  const booking = await loadOrNull(getBooking(session.user, id));
  return { title: booking?.reference ?? translate(locale, "admin.bookings") };
}

export default async function AdminBookingPage({ params }: Props) {
  const session = await getSession();
  const { id } = await params;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  if (!session) notFound();
  const booking = await loadOrNull(getBooking(session.user, id));
  if (!booking) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin/bookings" className="text-xs text-muted-foreground hover:text-foreground">{t("admin.bookings")}</Link>
      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeader as="h1" size="md" title={booking.title} description={booking.reference} />
          <StatusBadge domain="booking" value={booking.status} label={t(`bookings.status.${booking.status}`)} />
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{t("user.role.CUSTOMER")}</dt>
            <dd>
              <Link href={`/admin/users/${booking.customerId}`} className="font-medium text-primary">
                {booking.customer.identity?.fullName}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("user.role.PROFESSIONAL")}</dt>
            <dd>
              <Link href={`/admin/users/${booking.professionalId}`} className="font-medium text-primary">
                {booking.professional.professionalProfile?.businessName || booking.professional.identity?.fullName}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("bookings.price")}</dt>
            <dd className="font-semibold tabular-nums">{formatMoney(booking.price, { locale })}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("common.date")}</dt>
            <dd>
              {formatDateServer(booking.scheduledDate, locale)} · {cityName(booking.city, locale)}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">{booking.address}</p>
      </section>
    </div>
  );
}
