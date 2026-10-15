"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { ApiClientError, api } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n/provider";
import { errorMessageKey } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  targetType: "SERVICE" | "PROFESSIONAL";
  targetId: string;
  initialFavorited: boolean;
  signedIn: boolean;
  variant?: "outline" | "secondary" | "ghost";
  className?: string;
  showLabel?: boolean;
}

/**
 * Optimistic favorite toggle (§20).
 *
 * The heart flips immediately and rolls back on failure — the server endpoint
 * is an idempotent toggle, so a retry converges instead of double-flipping.
 * Anonymous visitors are routed to login with a `next` back to this page.
 */
export function FavoriteButton({
  targetType,
  targetId,
  initialFavorited,
  signedIn,
  variant = "outline",
  className,
  showLabel = true,
}: FavoriteButtonProps) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [favorited, setFavorited] = React.useState(initialFavorited);
  const [pending, setPending] = React.useState(false);

  // Re-sync when the server re-renders with a different target or state.
  React.useEffect(() => setFavorited(initialFavorited), [initialFavorited]);

  if (!signedIn) {
    return (
      <Button asChild variant={variant} className={className} title={t("favorites.requiresAuth")}>
        <a href={`/login?next=${encodeURIComponent(pathname)}`}>
          <Heart className={cn("h-4 w-4", !showLabel && "mx-auto")} aria-hidden />
          {showLabel ? t("services.detail.save") : <span className="sr-only">{t("services.detail.save")}</span>}
        </a>
      </Button>
    );
  }

  async function toggle() {
    if (pending) return;
    const previous = favorited;
    setFavorited(!previous); // optimistic
    setPending(true);
    try {
      const result = await api.post<{ favorited: boolean }>("/api/favorites", { targetType, targetId });
      setFavorited(result.favorited);
      toast.success(result.favorited ? t("favorites.added") : t("favorites.removed"));
      router.refresh();
    } catch (error) {
      setFavorited(previous); // rollback
      const key = error instanceof ApiClientError ? errorMessageKey(error.code) : "common.genericError";
      toast.error(t(key));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant={favorited ? "secondary" : variant}
      className={className}
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorited}
    >
      <Heart
        className={cn("h-4 w-4 transition-colors", favorited && "fill-destructive text-destructive", !showLabel && "mx-auto")}
        aria-hidden
      />
      {showLabel ? (
        favorited ? t("services.detail.saved") : t("services.detail.save")
      ) : (
        <span className="sr-only">{favorited ? t("services.detail.saved") : t("services.detail.save")}</span>
      )}
    </Button>
  );
}
