"use client";

import { StatusBadge, type StatusBadgeProps } from "@/components/shared/status-badge";
import { STATUS_DOMAINS, type StatusDomain } from "@/components/shared/status-config";
import { useI18n } from "@/lib/i18n/provider";

/** Status pill whose label follows the active UI language. */
export function StatusPill({
  domain,
  value,
  size,
  className,
}: {
  domain: StatusDomain;
  value: string | null | undefined;
  size?: StatusBadgeProps["size"];
  className?: string;
}) {
  const { t } = useI18n();
  if (!value) return null;
  return (
    <StatusBadge
      domain={domain}
      value={value}
      label={t(`${STATUS_DOMAINS[domain].prefix}${value}`)}
      size={size}
      className={className}
    />
  );
}
