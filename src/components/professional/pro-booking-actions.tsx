"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { mutationMessage } from "@/components/dashboard/mutation-message";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";

type BookingStatus = "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

/**
 * Professional booking controls. Completion stays with the customer —
 * this role confirms, starts, and may cancel (§16).
 */
export function ProBookingActions({ bookingId, status }: { bookingId: string; status: BookingStatus }) {
  const { t } = useI18n();
  const router = useRouter();
  const [reason, setReason] = React.useState("");

  async function transition(next: "CONFIRMED" | "IN_PROGRESS" | "CANCELLED") {
    await api.post(`/api/bookings/${bookingId}/transition`, {
      status: next,
      reason: next === "CANCELLED" ? reason.trim() || null : null,
    });
    toast.success(t(next === "CONFIRMED" ? "bookings.confirmed" : next === "IN_PROGRESS" ? "bookings.started" : "bookings.cancelled"));
    router.refresh();
  }

  const canConfirm = status === "PENDING";
  const canStart = status === "CONFIRMED";
  const canCancel = status === "PENDING" || status === "CONFIRMED" || status === "IN_PROGRESS";
  if (!canConfirm && !canStart && !canCancel) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {canConfirm && (
        <Button
          onClick={() =>
            transition("CONFIRMED").catch((error) =>
              toast.error(mutationMessage(error, t, { UNPROCESSABLE_ENTITY: "bookings.invalidTransition" }))
            )
          }
        >
          {t("bookings.confirm")}
        </Button>
      )}
      {canStart && (
        <Button
          onClick={() =>
            transition("IN_PROGRESS").catch((error) =>
              toast.error(mutationMessage(error, t, { UNPROCESSABLE_ENTITY: "bookings.invalidTransition" }))
            )
          }
        >
          {t("bookings.start")}
        </Button>
      )}
      {canCancel && (
        <ConfirmDialog
          variant="destructive"
          title={t("bookings.cancelConfirm.title")}
          description={t("bookings.cancelConfirm.body")}
          confirmLabel={t("bookings.cancel")}
          trigger={<Button variant="outline">{t("bookings.cancel")}</Button>}
          onConfirm={async () => {
            try {
              await transition("CANCELLED");
            } catch (error) {
              toast.error(mutationMessage(error, t, { UNPROCESSABLE_ENTITY: "bookings.invalidTransition" }));
              throw error;
            }
          }}
        >
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder={t("bookings.cancelReason")} />
        </ConfirmDialog>
      )}
    </div>
  );
}
