"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { mutationMessage } from "@/components/dashboard/mutation-message";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";

export function WithdrawOfferButton({ offerId }: { offerId: string }) {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <ConfirmDialog
      variant="destructive"
      title={t("offers.withdrawConfirm.title")}
      description={t("offers.withdrawConfirm.body")}
      confirmLabel={t("offers.withdraw")}
      trigger={
        <Button size="sm" variant="outline">
          {t("offers.withdraw")}
        </Button>
      }
      onConfirm={async () => {
        try {
          await api.post(`/api/offers/${offerId}/withdraw`);
          toast.success(t("offers.withdrawn"));
          router.refresh();
        } catch (error) {
          toast.error(mutationMessage(error, t));
          throw error;
        }
      }}
    />
  );
}
