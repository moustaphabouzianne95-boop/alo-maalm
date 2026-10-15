"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { mutationMessage } from "@/components/dashboard/mutation-message";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";

/** Quotation form. Price and eligibility are decided on the server, not here. */
export function OfferForm({ requestId, defaultPrice }: { requestId: string; defaultPrice?: number | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [price, setPrice] = React.useState(defaultPrice ? String(defaultPrice) : "");
  const [message, setMessage] = React.useState("");
  const [duration, setDuration] = React.useState("");
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const amount = Math.round(Number(price));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(t("validation.positiveNumber"));
      return;
    }
    if (message.trim().length < 10) {
      setError(t("validation.minLength"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await api.post(`/api/requests/${requestId}/offers`, {
        price: amount,
        message: message.trim(),
        durationMin: duration ? Math.round(Number(duration)) : null,
        proposedDate: date || null,
        proposedTime: time || null,
      });
      toast.success(t("offers.created"));
      router.refresh();
    } catch (err) {
      setError(
        mutationMessage(err, t, {
          CONFLICT: "offers.error.duplicate",
          UNPROCESSABLE_ENTITY: "offers.error.requestClosed",
          FORBIDDEN: "offers.error.notAvailable",
        })
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("offers.form.price")}</span>
          <Input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="numeric" placeholder="350" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("offers.form.duration")}</span>
          <Input value={duration} onChange={(event) => setDuration(event.target.value)} inputMode="numeric" placeholder="90" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("offers.form.proposedDate")}</span>
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("offers.form.proposedTime")}</span>
          <Input value={time} onChange={(event) => setTime(event.target.value)} placeholder="09:00-12:00" maxLength={24} />
        </label>
      </div>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">{t("offers.form.message")}</span>
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
          maxLength={2000}
          placeholder={t("offers.form.messagePlaceholder")}
        />
      </label>
      {error && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {t("offers.form.submit")}
      </Button>
    </form>
  );
}
