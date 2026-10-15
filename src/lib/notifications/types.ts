/**
 * Notification kinds.
 *
 * Stored as strings (not a DB enum) so shipping a new kind never needs a
 * migration. This union is the single source of truth for producers and for
 * the icon/colour mapping in the UI.
 */
export const NOTIFICATION_TYPES = [
  "NEW_REQUEST",
  "NEW_OFFER",
  "OFFER_ACCEPTED",
  "OFFER_REJECTED",
  "OFFER_WITHDRAWN",
  "NEW_MESSAGE",
  "BOOKING_CREATED",
  "BOOKING_CONFIRMED",
  "BOOKING_STARTED",
  "BOOKING_COMPLETED",
  "BOOKING_CANCELLED",
  "REVIEW_RECEIVED",
  "REVIEW_REPLY",
  "ACCOUNT_VERIFIED",
  "ACCOUNT_REJECTED",
  "ACCOUNT_SUSPENDED",
  "REPORT_RESOLVED",
  "SERVICE_PUBLISHED",
  "REQUEST_EXPIRING",
  "SYSTEM",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationPayload {
  requestId?: string;
  requestReference?: string;
  offerId?: string;
  offerReference?: string;
  bookingId?: string;
  bookingReference?: string;
  conversationId?: string;
  messageId?: string;
  reviewId?: string;
  serviceId?: string;
  reportId?: string;
  actorName?: string;
  amount?: number;
  [key: string]: unknown;
}

/** Deep link used by the notification bell and (later) push/email. */
export function notificationLink(type: NotificationType, payload: NotificationPayload, role: "CUSTOMER" | "PROFESSIONAL" | "ADMIN"): string {
  const base = role === "PROFESSIONAL" ? "/professional" : role === "ADMIN" ? "/admin" : "/dashboard";
  switch (type) {
    case "NEW_OFFER":
    case "OFFER_ACCEPTED":
    case "OFFER_REJECTED":
    case "OFFER_WITHDRAWN":
      return payload.requestId ? `${base}/requests/${payload.requestId}` : `${base}/requests`;
    case "NEW_REQUEST":
      return payload.requestId ? `${base}/requests/${payload.requestId}` : `${base}/requests`;
    case "BOOKING_CREATED":
    case "BOOKING_CONFIRMED":
    case "BOOKING_STARTED":
    case "BOOKING_COMPLETED":
    case "BOOKING_CANCELLED":
      return payload.bookingId ? `${base}/bookings/${payload.bookingId}` : `${base}/bookings`;
    case "NEW_MESSAGE":
      return payload.conversationId ? `${base}/messages/${payload.conversationId}` : `${base}/messages`;
    case "REVIEW_RECEIVED":
    case "REVIEW_REPLY":
      return `${base}/reviews`;
    case "ACCOUNT_VERIFIED":
    case "ACCOUNT_REJECTED":
    case "ACCOUNT_SUSPENDED":
      return role === "PROFESSIONAL" ? "/professional/profile" : "/dashboard/settings";
    case "REPORT_RESOLVED":
      return "/admin/reports";
    case "SERVICE_PUBLISHED":
      return payload.serviceId ? `${base}/services/${payload.serviceId}` : `${base}/services`;
    default:
      return base;
  }
}

/**
 * Icon + colour per notification kind.
 *
 * Kept next to the type union (rather than in the component) so the bell, the
 * notification page and any future email/push template all agree on how a kind
 * looks. Icon names resolve through `DynamicIcon` against `lucide-react`.
 */
export type NotificationTone = "brand" | "success" | "warning" | "danger" | "muted";

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  NEW_REQUEST: "Megaphone",
  NEW_OFFER: "HandCoins",
  OFFER_ACCEPTED: "BadgeCheck",
  OFFER_REJECTED: "XCircle",
  OFFER_WITHDRAWN: "Undo2",
  NEW_MESSAGE: "MessageSquare",
  BOOKING_CREATED: "CalendarPlus",
  BOOKING_CONFIRMED: "CalendarCheck",
  BOOKING_STARTED: "Hammer",
  BOOKING_COMPLETED: "CircleCheck",
  BOOKING_CANCELLED: "CalendarX",
  REVIEW_RECEIVED: "Star",
  REVIEW_REPLY: "Reply",
  ACCOUNT_VERIFIED: "ShieldCheck",
  ACCOUNT_REJECTED: "ShieldX",
  ACCOUNT_SUSPENDED: "ShieldBan",
  REPORT_RESOLVED: "Flag",
  SERVICE_PUBLISHED: "Sparkles",
  REQUEST_EXPIRING: "Timer",
  SYSTEM: "Info",
};

export const NOTIFICATION_TONES: Record<NotificationType, NotificationTone> = {
  NEW_REQUEST: "brand",
  NEW_OFFER: "brand",
  OFFER_ACCEPTED: "success",
  OFFER_REJECTED: "muted",
  OFFER_WITHDRAWN: "muted",
  NEW_MESSAGE: "brand",
  BOOKING_CREATED: "brand",
  BOOKING_CONFIRMED: "success",
  BOOKING_STARTED: "brand",
  BOOKING_COMPLETED: "success",
  BOOKING_CANCELLED: "danger",
  REVIEW_RECEIVED: "success",
  REVIEW_REPLY: "brand",
  ACCOUNT_VERIFIED: "success",
  ACCOUNT_REJECTED: "danger",
  ACCOUNT_SUSPENDED: "danger",
  REPORT_RESOLVED: "success",
  SERVICE_PUBLISHED: "success",
  REQUEST_EXPIRING: "warning",
  SYSTEM: "muted",
};

export function notificationIcon(type: string): string {
  return NOTIFICATION_ICONS[type as NotificationType] ?? "Bell";
}

export function notificationTone(type: string): NotificationTone {
  return NOTIFICATION_TONES[type as NotificationType] ?? "muted";
}
