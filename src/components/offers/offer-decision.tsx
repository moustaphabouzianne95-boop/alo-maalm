"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Clock, MapPin, MessageSquare, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusPill } from "@/components/dashboard/status-pill";
import { mutationMessage } from "@/components/dashboard/mutation-message";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export interface OfferDecisionData {
  id: string;
  price: number;
  message: string;
  notes: string | null;
  durationMin: number | null;
  proposedDate: string | null;
  proposedTime: string | null;
  validUntil: string | null;
  status: string;
  professionalUserId: string;
  professionalName: string;
  professionalSlug: string | null;
  avatarUrl: string | null;
  verified: boolean;
  ratingAverage: number;
  ratingCount: number;
  completedJobs: number;
  city: string | null;
  badges: Array<"bestPrice" | "fastest" | "topRated">;
  canDecide: boolean;
  canMessage: boolean;
  requestId: string;
  bookingId: string | null;
}

const BADGE_KEY = {
  bestPrice: "offers.compare.bestPrice",
  fastest: "offers.compare.fastest",
  topRated: "offers.compare.topRated",
} as const;

/**
 * One quotation on the customer's request page.
 * Accept runs the transactional endpoint; the booking id comes back from the server.
 */
export function OfferDecisionCard({ offer }: { offer: OfferDecisionData }) {
  const { t, formatMoney, formatDate, formatNumber } = useI18n();
  const router = useRouter();
  const [messaging, setMessaging] = React.useState(false);

  async function accept() {
    const result = await api.post<{ bookingId: string }>(`/api/offers/${offer.id}/accept`);
    toast.success(t("offers.accepted"));
    router.push(`/dashboard/bookings/${result.bookingId}`);
    router.refresh();
  }

  async function reject() {
    await api.delete(`/api/offers/${offer.id}`);
    toast.success(t("offers.rejected"));
    router.refresh();
  }

  async function message() {
    setMessaging(true);
    try {
      const conversation = await api.post<{ id: string }>("/api/messages", {
        withUserId: offer.professionalUserId,
        requestId: offer.requestId,
        subject: offer.professionalName,
      });
      if (!conversation?.id) throw new Error("missing id");
      router.push(`/dashboard/messages/${conversation.id}`);
      router.refresh();
    } catch (error) {
      toast.error(mutationMessage(error, t));
    } finally {
      setMessaging(false);
    }
  }

  return (
    <article className={cn("rounded-xl border bg-card p-4 shadow-sm", offer.status === "ACCEPTED" && "ring-1 ring-brand-300")}>
      <div className="flex items-start gap-3">
        <UserAvatar name={offer.professionalName} src={offer.avatarUrl} size="md" rounded="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {offer.professionalSlug ? (
              <Link href={`/professionals/${offer.professionalSlug}`} className="truncate text-sm font-semibold hover:text-primary">
                {offer.professionalName}
              </Link>
            ) : (
              <span className="truncate text-sm font-semibold">{offer.professionalName}</span>
            )}
            {offer.verified && <BadgeCheck className="h-4 w-4 text-brand-600" aria-label={t("common.verified")} />}
            <StatusPill domain="offer" value={offer.status} size="sm" />
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3 fill-gold-400 text-gold-400" aria-hidden />
              {formatNumber(offer.ratingAverage, 1)} ({formatNumber(offer.ratingCount)})
            </span>
            <span>{t("common.completedJobs")}: {formatNumber(offer.completedJobs)}</span>
            {offer.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden />
                {offer.city}
              </span>
            )}
          </p>
        </div>
        <p className="text-lg font-bold tabular-nums text-foreground">{formatMoney(offer.price)}</p>
      </div>

      {offer.badges.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {offer.badges.map((badge) => (
            <span key={badge} className="inline-flex items-center gap-1 rounded-full bg-gold-50 px-2 py-0.5 text-[11px] font-medium text-gold-700 ring-1 ring-inset ring-gold-200">
              <Zap className="h-3 w-3" aria-hidden />
              {t(BADGE_KEY[badge])}
            </span>
          ))}
        </div>
      )}

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{offer.message}</p>
      {offer.notes && <p className="mt-2 text-xs text-muted-foreground">{offer.notes}</p>}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {offer.durationMin != null && offer.durationMin > 0 && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden />
            {t("bookings.duration")}: {offer.durationMin} {t("common.minutes")}
          </span>
        )}
        {offer.proposedDate && (
          <span>
            {formatDate(offer.proposedDate)}
            {offer.proposedTime ? ` · ${offer.proposedTime}` : ""}
          </span>
        )}
        {offer.validUntil && <span>{t("offers.validUntil", { date: formatDate(offer.validUntil) })}</span>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {offer.canDecide && (
          <>
            <ConfirmDialog
              title={t("offers.acceptConfirm.title")}
              description={t("offers.acceptConfirm.body", { name: offer.professionalName, price: formatMoney(offer.price) })}
              confirmLabel={t("offers.compare.accept")}
              trigger={<Button size="sm">{t("offers.compare.accept")}</Button>}
              onConfirm={async () => {
                try {
                  await accept();
                } catch (error) {
                  toast.error(mutationMessage(error, t, { CONFLICT: "offers.error.alreadyDecided", UNPROCESSABLE_ENTITY: "offers.error.requestClosed" }));
                  throw error;
                }
              }}
            />
            <ConfirmDialog
              variant="destructive"
              title={t("offers.rejectConfirm.title")}
              description={t("offers.rejectConfirm.body")}
              confirmLabel={t("offers.reject")}
              trigger={
                <Button size="sm" variant="outline">
                  {t("offers.reject")}
                </Button>
              }
              onConfirm={async () => {
                try {
                  await reject();
                } catch (error) {
                  toast.error(mutationMessage(error, t));
                  throw error;
                }
              }}
            />
          </>
        )}
        {offer.bookingId && (
          <Button size="sm" variant="secondary" asChild>
            <Link href={`/dashboard/bookings/${offer.bookingId}`}>{t("requests.detail.booking")}</Link>
          </Button>
        )}
        {offer.canMessage && (
          <Button size="sm" variant="ghost" onClick={message} disabled={messaging}>
            <MessageSquare className="h-4 w-4" aria-hidden />
            {t("professionals.profile.message")}
          </Button>
        )}
      </div>
    </article>
  );
}
