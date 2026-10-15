import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/shared/section-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { loadOrNull } from "@/lib/api/or-not-found";
import { getSession } from "@/lib/auth/session";
import { cityName, formatMoney } from "@/lib/constants/morocco";
import { getLocale } from "@/lib/i18n/get-locale";
import { translate } from "@/lib/i18n/translate";
import { getRequest } from "@/server/requests/service";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession();
  const locale = await getLocale();
  if (!session) return { title: translate(locale, "admin.requests") };
  const request = await loadOrNull(getRequest(session.user, id));
  return { title: request?.title ?? translate(locale, "admin.requests") };
}

export default async function AdminRequestPage({ params }: Props) {
  const session = await getSession();
  const { id } = await params;
  const locale = await getLocale();
  const t = (key: string) => translate(locale, key);
  if (!session) notFound();
  const request = await loadOrNull(getRequest(session.user, id));
  if (!request) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin/requests" className="text-xs text-muted-foreground hover:text-foreground">{t("admin.requests")}</Link>
      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeader as="h1" size="md" title={request.title} description={request.reference} />
          <StatusBadge domain="request" value={request.status} label={t(`requests.status.${request.status}`)} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          <Link href={`/admin/users/${request.customerId}`} className="hover:text-foreground">{request.customer.identity?.fullName}</Link>
          {" · "}
          {cityName(request.city, locale)}
        </p>
        <p className="mt-4 whitespace-pre-wrap text-sm">{request.description}</p>
        <h2 className="mt-6 text-sm font-semibold">{t("admin.offers")}</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {request.offers.map((offer) => (
            <li key={offer.id} className="flex justify-between gap-3 rounded-lg border px-3 py-2">
              <span>{offer.professional.professionalProfile?.businessName || offer.professional.identity?.fullName}</span>
              <span className="tabular-nums">{formatMoney(offer.price, { locale })} · {t(`offers.status.${offer.status}`)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
