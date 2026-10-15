/**
 * Single source of truth for how every status is coloured across the app.
 * Server *and* client components read this, so a `COMPLETED` booking looks
 * identical in a dashboard card, a table row and a detail page.
 */
export type StatusTone = "success" | "warning" | "danger" | "info" | "muted" | "brand";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200",
  warning: "bg-gold-50 text-gold-700 ring-1 ring-inset ring-gold-200",
  danger: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  info: "bg-ink-50 text-ink-700 ring-1 ring-inset ring-ink-200",
  muted: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  brand: "bg-brand-600 text-white",
};

const DOT_CLASSES: Record<StatusTone, string> = {
  success: "bg-brand-500",
  warning: "bg-gold-500",
  danger: "bg-red-500",
  info: "bg-ink-400",
  muted: "bg-muted-foreground",
  brand: "bg-white",
};

export function toneClasses(tone: StatusTone) {
  return TONE_CLASSES[tone];
}

export function dotClasses(tone: StatusTone) {
  return DOT_CLASSES[tone];
}

type StatusMaps = Record<string, StatusTone>;

export const REQUEST_STATUS_TONE: StatusMaps = {
  OPEN: "info",
  RECEIVING_OFFERS: "warning",
  OFFER_SELECTED: "brand",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
  EXPIRED: "muted",
};

export const OFFER_STATUS_TONE: StatusMaps = {
  PENDING: "warning",
  ACCEPTED: "success",
  REJECTED: "danger",
  WITHDRAWN: "muted",
  EXPIRED: "muted",
};

export const BOOKING_STATUS_TONE: StatusMaps = {
  PENDING: "warning",
  CONFIRMED: "info",
  IN_PROGRESS: "brand",
  COMPLETED: "success",
  CANCELLED: "danger",
};

export const PAYMENT_STATUS_TONE: StatusMaps = {
  UNPAID: "muted",
  PENDING: "warning",
  PAID: "success",
  REFUNDED: "info",
};

export const USER_STATUS_TONE: StatusMaps = {
  ACTIVE: "success",
  PENDING: "warning",
  SUSPENDED: "danger",
  DEACTIVATED: "muted",
};

export const VERIFICATION_STATUS_TONE: StatusMaps = {
  PENDING: "warning",
  VERIFIED: "success",
  REJECTED: "danger",
  SUSPENDED: "danger",
};

export const SERVICE_STATUS_TONE: StatusMaps = {
  DRAFT: "muted",
  PUBLISHED: "success",
  PAUSED: "warning",
  HIDDEN: "danger",
};

export const AVAILABILITY_TONE: StatusMaps = {
  AVAILABLE: "success",
  BUSY: "warning",
  UNAVAILABLE: "danger",
};

export const URGENCY_TONE: StatusMaps = {
  NORMAL: "info",
  URGENT: "warning",
  EMERGENCY: "danger",
};

export const REPORT_STATUS_TONE: StatusMaps = {
  OPEN: "warning",
  INVESTIGATING: "info",
  RESOLVED: "success",
  DISMISSED: "muted",
};

export const REVIEW_STATUS_TONE: StatusMaps = {
  PUBLISHED: "success",
  HIDDEN: "danger",
  UNDER_REVIEW: "warning",
};

/** i18n key prefix + tone map, keyed by domain — consumed by `<StatusBadge>`. */
export const STATUS_DOMAINS = {
  request: { prefix: "requests.status.", tones: REQUEST_STATUS_TONE },
  offer: { prefix: "offers.status.", tones: OFFER_STATUS_TONE },
  booking: { prefix: "bookings.status.", tones: BOOKING_STATUS_TONE },
  payment: { prefix: "bookings.payment.", tones: PAYMENT_STATUS_TONE },
  user: { prefix: "user.status.", tones: USER_STATUS_TONE },
  verification: { prefix: "verification.status.", tones: VERIFICATION_STATUS_TONE },
  service: { prefix: "services.status.", tones: SERVICE_STATUS_TONE },
  availability: { prefix: "common.", tones: AVAILABILITY_TONE },
  urgency: { prefix: "requests.urgency.", tones: URGENCY_TONE },
  report: { prefix: "reports.status.", tones: REPORT_STATUS_TONE },
  review: { prefix: "reviews.status.", tones: REVIEW_STATUS_TONE },
} as const;

export type StatusDomain = keyof typeof STATUS_DOMAINS;

export function toneFor(domain: StatusDomain, value: string): StatusTone {
  return STATUS_DOMAINS[domain].tones[value] ?? "muted";
}
