"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { mutationMessage } from "@/components/dashboard/mutation-message";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";

/** Publish, pause, or delete a service the caller owns. Hidden is admin-only. */
export function ServiceActions({ id, status }: { id: string; status: string }) {
  const { t } = useI18n();
  const router = useRouter();

  async function setStatus(next: "PUBLISHED" | "PAUSED" | "DRAFT") {
    await api.patch(`/api/services/${id}`, { status: next });
    toast.success(t(next === "PUBLISHED" ? "services.published" : "services.updated"));
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "PUBLISHED" && status !== "HIDDEN" && (
        <Button size="sm" onClick={() => setStatus("PUBLISHED").catch((error) => toast.error(mutationMessage(error, t)))}>
          {t("services.form.publish")}
        </Button>
      )}
      {status === "PUBLISHED" && (
        <Button size="sm" variant="outline" onClick={() => setStatus("PAUSED").catch((error) => toast.error(mutationMessage(error, t)))}>
          {t("services.unpublished")}
        </Button>
      )}
      {status !== "HIDDEN" && (
        <ConfirmDialog
          variant="destructive"
          title={t("services.deleteConfirm.title")}
          description={t("services.deleteConfirm.body")}
          confirmLabel={t("common.delete")}
          trigger={
            <Button size="sm" variant="ghost">
              {t("common.delete")}
            </Button>
          }
          onConfirm={async () => {
            try {
              await api.delete(`/api/services/${id}`);
              toast.success(t("services.deleted"));
              router.push("/professional/services");
              router.refresh();
            } catch (error) {
              toast.error(mutationMessage(error, t));
              throw error;
            }
          }}
        />
      )}
    </div>
  );
}
