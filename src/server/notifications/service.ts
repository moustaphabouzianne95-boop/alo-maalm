import type { DbClient } from "@/lib/db/types";
import { prisma } from "@/lib/db/prisma";
import { paginationMeta } from "@/lib/validation/common";
import { notificationLink, type NotificationPayload, type NotificationType } from "@/lib/notifications/types";
import type { Role } from "@prisma/client";

/**
 * In-app notification service.
 *
 * Writes are transaction-aware: pass the active `tx` client to keep a
 * notification atomic with the business event that caused it. The `channels`
 * column records intent (`{ inApp: "sent", email: "skipped" }`) so email/push
 * delivery can be layered on later without changing any producer.
 */
export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  data?: NotificationPayload;
  linkTo?: string | null;
  role?: Role;
}

function toRow(input: CreateNotificationInput) {
  return {
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    data: (input.data ?? {}) as object,
    linkTo: input.linkTo ?? notificationLink(input.type, input.data ?? {}, input.role ?? "CUSTOMER"),
    channels: { inApp: "sent", email: "skipped", push: "skipped" } as object,
  };
}

export async function createNotification(input: CreateNotificationInput, client: DbClient = prisma) {
  return client.notification.create({ data: toRow(input) });
}

export async function createNotifications(inputs: CreateNotificationInput[], client: DbClient = prisma) {
  if (!inputs.length) return { count: 0 };
  const rows = inputs.map(toRow).filter((r) => Boolean(r.userId));
  if (!rows.length) return { count: 0 };
  return client.notification.createMany({ data: rows });
}

/** Scoped by userId — a notification can only be read by its owner. */
export async function markNotificationRead(id: string, userId: string, client: DbClient = prisma) {
  return client.notification.updateMany({
    where: { id, userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string, client: DbClient = prisma) {
  return client.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function unreadNotificationCount(userId: string, client: DbClient = prisma) {
  return client.notification.count({ where: { userId, isRead: false } });
}

export interface ListNotificationsInput {
  userId: string;
  page?: number;
  perPage?: number;
  unreadOnly?: boolean;
  type?: NotificationType;
}

export async function listNotifications(input: ListNotificationsInput) {
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(50, Math.max(1, input.perPage ?? 20));
  const where = {
    userId: input.userId,
    ...(input.unreadOnly ? { isRead: false } : {}),
    ...(input.type ? { type: input.type } : {}),
  };
  const [items, total, unreadTotal] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: input.userId, isRead: false } }),
  ]);
  return { items, unreadTotal, ...paginationMeta(page, perPage, total) };
}
