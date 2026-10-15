"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, hueFromString, initialsOf } from "@/lib/utils";

export interface UserAvatarProps {
  name?: string | null;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  rounded?: "full" | "xl";
  ring?: boolean;
}

const SIZES = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-8 w-8 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-sm",
  xl: "h-20 w-20 text-lg",
  "2xl": "h-28 w-28 text-2xl",
} as const;

/**
 * Avatar with a deterministic colour fallback derived from the name, so every
 * seeded Moroccan profile renders consistently without an uploaded photo.
 */
export function UserAvatar({ name, src, size = "md", className, rounded = "full", ring = false }: UserAvatarProps) {
  const hue = hueFromString(name ?? "alomaalem");
  return (
    <Avatar
      className={cn(
        SIZES[size],
        rounded === "xl" ? "rounded-xl" : "rounded-full",
        ring && "ring-2 ring-background",
        className
      )}
      style={
        {
          "--avatar-bg": `hsl(${hue} 55% 92%)`,
          "--avatar-fg": `hsl(${hue} 60% 32%)`,
        } as React.CSSProperties
      }
    >
      {src ? <AvatarImage src={src} alt={name ?? ""} /> : null}
      <AvatarFallback
        className="font-bold"
        style={{ background: `hsl(${hue} 55% 92%)`, color: `hsl(${hue} 60% 30%)` }}
        aria-label={name ?? ""}
      >
        {initialsOf(name ?? "")}
      </AvatarFallback>
    </Avatar>
  );
}
