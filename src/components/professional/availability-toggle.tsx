"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/use-toast";
import { mutationMessage } from "@/components/dashboard/mutation-message";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

const STATUSES = ["AVAILABLE", "BUSY", "UNAVAILABLE"] as const;
type Availability = (typeof STATUSES)[number];

const LABEL: Record<Availability, string> = {
  AVAILABLE: "common.available",
  BUSY: "common.busy",
  UNAVAILABLE: "common.unavailable",
};

/** Writes availability to the professional profile. Offers are refused while unavailable. */
export function AvailabilityToggle({ value }: { value: Availability }) {
  const { t } = useI18n();
  const router = useRouter();
  const [current, setCurrent] = React.useState(value);
  const [pending, setPending] = React.useState(false);

  async function choose(next: Availability) {
    if (next === current || pending) return;
    const previous = current;
    setCurrent(next);
    setPending(true);
    try {
      await api.patch("/api/account/professional", { availabilityStatus: next });
      toast.success(t("pro.availabilityUpdated"));
      router.refresh();
    } catch (error) {
      setCurrent(previous);
      toast.error(mutationMessage(error, t));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="inline-flex rounded-full bg-muted p-1" role="radiogroup" aria-label={t("pro.toggleAvailability")}>
      {STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          role="radio"
          aria-checked={current === status}
          disabled={pending}
          onClick={() => choose(status)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            current === status ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          )}
        >
          {t(LABEL[status])}
        </button>
      ))}
    </div>
  );
}
