"use client";

import * as React from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Global error boundary (§51: never expose stack traces to users).
 * Only the opaque `digest` is shown — enough for support to find the server
 * log entry, useless to an attacker.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  React.useEffect(() => {
    // The full error goes to the console for developers, never to the DOM.
    console.error(error);
  }, [error]);

  return (
    <div className="page-shell flex flex-1 flex-col items-center justify-center py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-5 text-xl font-bold">{t("common.somethingWentWrong")}</h1>
      <p className="prose-ma mt-2 max-w-sm">{t("common.genericError")}</p>
      {error.digest ? (
        <p className="mt-2 text-[11px] text-muted-foreground" dir="ltr">
          ref: {error.digest}
        </p>
      ) : null}
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>{t("common.retry")}</Button>
        <Button asChild variant="outline">
          <Link href="/">{t("nav.home")}</Link>
        </Button>
      </div>
    </div>
  );
}
