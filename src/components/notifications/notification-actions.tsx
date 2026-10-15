"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { mutationMessage } from "@/components/dashboard/mutation-message";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export function MarkAllReadButton({ disabled }: { disabled?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={async () => {
        try {
          await api.post("/api/notifications/read-all");
          toast.success(t("notifications.allRead"));
          router.refresh();
        } catch (error) {
          toast.error(mutationMessage(error, t));
        }
      }}
    >
      {t("notifications.markAllRead")}
    </Button>
  );
}

/** Marks one notification read, then follows its deep link. */
export function NotificationLink({
  id,
  href,
  unread,
  className,
  children,
}: {
  id: string;
  href: string;
  unread: boolean;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={async () => {
        if (unread) {
          try {
            await api.post(`/api/notifications/${id}/read`);
          } catch (error) {
            toast.error(mutationMessage(error, t));
          }
        }
        router.push(href);
        router.refresh();
      }}
      className={cn("block w-full text-start", className)}
    >
      {children}
    </button>
  );
}
