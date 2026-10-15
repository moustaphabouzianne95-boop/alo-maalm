"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { mutationMessage } from "@/components/dashboard/mutation-message";
import { api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

interface ReviewFormProps {
  mode: "create" | "edit";
  bookingId?: string;
  reviewId?: string;
  initialRating?: number;
  initialComment?: string;
  initialSub?: { punctuality?: number; quality?: number; communication?: number };
}

function StarPicker({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <span className="inline-flex" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={value === score}
            onClick={() => onChange(score)}
            className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Star
              className={cn("h-5 w-5", score <= value ? "fill-gold-400 text-gold-400" : "text-muted-foreground/30")}
              aria-hidden
            />
            <span className="sr-only">{score}</span>
          </button>
        ))}
      </span>
    </div>
  );
}

/** Review composer. Eligibility and the one-review-per-booking rule are enforced server-side. */
export function ReviewForm({ mode, bookingId, reviewId, initialRating = 0, initialComment = "", initialSub }: ReviewFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [rating, setRating] = React.useState(initialRating);
  const [comment, setComment] = React.useState(initialComment);
  const [punctuality, setPunctuality] = React.useState(initialSub?.punctuality ?? 0);
  const [quality, setQuality] = React.useState(initialSub?.quality ?? 0);
  const [communication, setCommunication] = React.useState(initialSub?.communication ?? 0);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (rating < 1) {
      setError(t("validation.rating"));
      return;
    }
    setPending(true);
    setError(null);
    const body = {
      rating,
      comment: comment.trim() || null,
      subRatings: {
        ...(punctuality ? { punctuality } : {}),
        ...(quality ? { quality } : {}),
        ...(communication ? { communication } : {}),
      },
    };
    try {
      if (mode === "create") {
        await api.post(`/api/bookings/${bookingId}/review`, body);
        toast.success(t("reviews.created"));
      } else {
        await api.patch(`/api/reviews/${reviewId}`, body);
        toast.success(t("reviews.updated"));
      }
      router.refresh();
    } catch (err) {
      setError(
        mutationMessage(err, t, {
          CONFLICT: "reviews.error.duplicate",
          UNPROCESSABLE_ENTITY: "reviews.error.notEligible",
          FORBIDDEN: "reviews.locked",
        })
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <StarPicker value={rating} onChange={setRating} label={t("reviews.form.rating")} />
      <StarPicker value={punctuality} onChange={setPunctuality} label={t("reviews.form.punctuality")} />
      <StarPicker value={quality} onChange={setQuality} label={t("reviews.form.quality")} />
      <StarPicker value={communication} onChange={setCommunication} label={t("reviews.form.communication")} />
      <Textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        maxLength={2000}
        rows={4}
        placeholder={t("reviews.form.commentPlaceholder")}
        aria-label={t("reviews.form.comment")}
      />
      {error && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {t(mode === "create" ? "reviews.form.submit" : "reviews.form.update")}
      </Button>
    </form>
  );
}
