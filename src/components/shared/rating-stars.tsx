import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Five-star rating display.
 *
 * Purely presentational and server-safe: no client bundle, no interaction.
 * `value` is rounded to the nearest star; the exact number is rendered next to
 * it by the caller so nothing is implied that the data does not say.
 */
export function RatingStars({
  value,
  size = 14,
  className,
  label,
}: {
  value: number | null | undefined;
  size?: number;
  className?: string;
  label?: string;
}) {
  const score = Number.isFinite(Number(value)) ? Number(value) : 0;
  const filled = Math.round(score);

  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={label ?? `${score.toFixed(1)} / 5`}
      title={label}
    >
      {[1, 2, 3, 4, 5].map((index) => (
        <Star
          key={index}
          style={{ width: size, height: size }}
          className={cn(
            "shrink-0",
            index <= filled ? "fill-gold-400 text-gold-400" : "text-muted-foreground/25"
          )}
          aria-hidden
        />
      ))}
    </span>
  );
}
