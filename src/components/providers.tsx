"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DirectionProvider } from "@/components/ui/direction-provider";
import { Toaster } from "@/components/ui/toaster";
import { I18nProvider } from "@/lib/i18n/provider";
import type { LangCode } from "@/lib/i18n/config";

/**
 * Client provider stack, mounted once in the root layout:
 *   I18n (locale + RTL) → Radix Direction → TanStack Query → Tooltip → Toaster
 */
export function Providers({ locale, children }: { locale: LangCode; children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Marketplace reads change slowly; keep data fresh without a
            // refetch storm while the user moves between dashboard tabs.
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              const status = (error as { status?: number })?.status ?? 0;
              if (status >= 400 && status < 500) return false;
              return failureCount < 2;
            },
          },
          mutations: { retry: false },
        },
      })
  );

  return (
    <I18nProvider locale={locale}>
      <DirectionProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={200} skipDelayDuration={300}>
            {children}
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </DirectionProvider>
    </I18nProvider>
  );
}
