"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";
import { useI18n } from "@/lib/i18n/provider";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

/** Consistent failure surface (§41) with a retry affordance. */
export function ErrorState({ title, description, onRetry, retrying, className }: ErrorStateProps) {
  const { t } = useI18n();
  return (
    <EmptyState
      className={className}
      icon={<AlertTriangle className="text-destructive" />}
      title={title ?? t("error.default.title")}
      description={description ?? t("error.default.body")}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
            <RefreshCw className={retrying ? "animate-spin" : undefined} />
            {t("common.retry")}
          </Button>
        ) : undefined
      }
    />
  );
}
