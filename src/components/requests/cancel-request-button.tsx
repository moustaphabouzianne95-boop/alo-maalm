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

/** Cancels an open request. Pending offers are closed by the server, not the client. */
export function CancelRequestButton({ requestId }: { requestId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [reason, setReason] = React.useState("");

  return (
    <ConfirmDialog
      variant="destructive"
      title={t("requests.detail.cancelConfirm.title")}
      description={t("requests.detail.cancelConfirm.body")}
      confirmLabel={t("requests.detail.cancel")}
      trigger={<Button variant="outline">{t("requests.detail.cancel")}</Button>}
      onConfirm={async () => {
        try {
          await api.post(`/api/requests/${requestId}/cancel`, { reason: reason.trim() || null });
          toast.success(t("requests.cancelled"));
          router.refresh();
        } catch (error) {
          toast.error(mutationMessage(error, t));
          throw error;
        }
      }}
    >
      <Textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={500}
        placeholder={t("common.reason")}
        className="mt-2"
      />
    </ConfirmDialog>
  );
}
