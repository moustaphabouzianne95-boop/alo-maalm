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
 * Customer-side booking controls.
 * Confirmation and start belong to the professional; completion and cancellation
 * are the transitions this role is allowed to drive (§16).
 */
export function BookingActions({ bookingId, status }: { bookingId: string; status: BookingStatus }) {
  const { t } = useI18n();
  const router = useRouter();
  const [reason, setReason] = React.useState("");

  const canComplete = status === "CONFIRMED" || status === "IN_PROGRESS";
  const canCancel = status === "PENDING" || status === "CONFIRMED" || status === "IN_PROGRESS";
  if (!canComplete && !canCancel) return null;

  async function transition(next: "COMPLETED" | "CANCELLED") {
    await api.post(`/api/bookings/${bookingId}/transition`, {
      status: next,
      reason: next === "CANCELLED" ? reason.trim() || null : null,
    });
    toast.success(t(next === "COMPLETED" ? "bookings.completed" : "bookings.cancelled"));
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canComplete && (
        <ConfirmDialog
          title={t("bookings.complete")}
          description={t("bookings.completeCustomer")}
          confirmLabel={t("bookings.complete")}
          trigger={<Button>{t("bookings.complete")}</Button>}
          onConfirm={async () => {
            try {
              await transition("COMPLETED");
            } catch (error) {
              toast.error(mutationMessage(error, t, { UNPROCESSABLE_ENTITY: "bookings.invalidTransition" }));
              throw error;
            }
          }}
        />
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
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder={t("bookings.cancelReason")}
            className="mt-2"
          />
        </ConfirmDialog>
      )}
    </div>
  );
}
