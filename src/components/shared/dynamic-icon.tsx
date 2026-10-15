"use client";

import * as React from "react";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Resolves a Lucide icon *name* stored in the database (`Category.icon`) to a
 * component at render time.
 *
 * The icon set is imported as a namespace so tree-shaking still applies at the
 * bundler level for icons referenced statically elsewhere; the fallback keeps a
 * bad DB value from crashing the page.
 */
const iconCache = new Map<string, React.ComponentType<{ className?: string }>>();

function resolve(name?: string | null) {
  if (!name) return LucideIcons.Wrench;
  if (iconCache.has(name)) return iconCache.get(name)!;
  const record = LucideIcons as unknown as Record<string, unknown>;
  const direct = record[name];
  if (typeof direct === "function" || (direct && typeof direct === "object")) {
    const component = direct as React.ComponentType<{ className?: string }>;
    iconCache.set(name, component);
    return component;
  }
  // Try PascalCase normalisation ("wrench" → "Wrench").
  const pascal = name.charAt(0).toUpperCase() + name.slice(1);
  const alt = record[pascal];
  const component = (typeof alt === "function" || (alt && typeof alt === "object")
    ? (alt as React.ComponentType<{ className?: string }>)
    : LucideIcons.Wrench);
  iconCache.set(name, component);
  return component;
}

export interface DynamicIconProps {
  name?: string | null;
  className?: string;
  color?: string;
  "aria-hidden"?: boolean;
}

export function DynamicIcon({ name, className, color }: DynamicIconProps) {
  const Icon = resolve(name);
  return <Icon className={cn("h-5 w-5", className)} style={color ? { color } : undefined} aria-hidden />;
}

/** Small palette used for category tiles so the grid feels curated, not random. */
export const CATEGORY_TONES = [
  { bg: "bg-brand-50", fg: "text-brand-700", ring: "ring-brand-100" },
  { bg: "bg-ink-50", fg: "text-ink-700", ring: "ring-ink-100" },
  { bg: "bg-gold-50", fg: "text-gold-700", ring: "ring-gold-100" },
  { bg: "bg-sky-50", fg: "text-sky-700", ring: "ring-sky-100" },
  { bg: "bg-rose-50", fg: "text-rose-700", ring: "ring-rose-100" },
  { bg: "bg-violet-50", fg: "text-violet-700", ring: "ring-violet-100" },
  { bg: "bg-teal-50", fg: "text-teal-700", ring: "ring-teal-100" },
  { bg: "bg-amber-50", fg: "text-amber-700", ring: "ring-amber-100" },
] as const;

export function toneForIndex(index: number) {
  return CATEGORY_TONES[index % CATEGORY_TONES.length]!;
}
