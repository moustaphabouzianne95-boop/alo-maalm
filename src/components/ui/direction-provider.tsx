"use client";

import * as React from "react";
import { DirectionProvider as RadixDirectionProvider } from "@radix-ui/react-direction";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Radix primitives position popovers/selects using physical direction.
 * This wrapper feeds them the active locale's direction so dropdowns,
 * tooltips and dialogs open on the correct side in Arabic (RTL).
 */
export function DirectionProvider({ children }: { children: React.ReactNode }) {
  const { dir } = useI18n();
  return <RadixDirectionProvider dir={dir}>{children}</RadixDirectionProvider>;
}
