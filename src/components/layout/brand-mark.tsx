import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The ألو المعلم mark: a stylised "m" shaped like a rooftop antenna / handshake
 * arc. Rendered from inline SVG so it never depends on a font or image file.
 */
export function BrandIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm",
        className
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M4 13a8 8 0 0 1 16 0" />
        <path d="M8.5 13v3.5a1.5 1.5 0 0 0 3 0V13" />
        <path d="M15.5 13v2a1.5 1.5 0 0 0 3 0v-2" />
      </svg>
    </span>
  );
}

interface BrandLinkProps {
  name?: string;
  tagline?: string;
  /** Two-line lockup (name over tagline) used by the navbar on ≥sm. */
  stacked?: boolean;
  /** White-on-dark variant for the footer. */
  dark?: boolean;
  className?: string;
}

export function BrandLink({ name, tagline, stacked = false, dark = false, className }: BrandLinkProps) {
  return (
    <Link
      href="/"
      className={cn("flex shrink-0 items-center gap-2 rounded-lg focus-visible:ring-2 focus-visible:ring-ring", className)}
      aria-label={name}
    >
      <BrandIcon className={dark ? "h-9 w-9 bg-brand-500 text-white" : undefined} />
      {name ? (
        stacked ? (
          <span className="hidden flex-col leading-none sm:flex">
            <span className={cn("text-base font-extrabold tracking-tight", dark && "text-white")}>{name}</span>
            {tagline ? (
              <span className={cn("mt-0.5 text-[10px]", dark ? "text-ink-300" : "text-muted-foreground")}>
                {tagline}
              </span>
            ) : null}
          </span>
        ) : (
          <span className={cn("text-lg font-extrabold tracking-tight", dark ? "text-white" : "text-foreground")}>
            {name}
          </span>
        )
      ) : null}
    </Link>
  );
}
