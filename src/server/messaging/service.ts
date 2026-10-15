import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { notFound, forbidden, unprocessable, conflict } from "@/lib/api/errors";
import { paginationMeta, type PaginationInput, sanitizedTextSchema } from "@/lib/validation/common";
import { canAccessConversation, type Actor } from "@/lib/permissions";
import { createNotification } from "@/server/notifications/service";
import { truncate } from "@/lib/utils";

/**
 * Conversations & messages (§17).
 *
 * A conversation is a 1:1 customer ↔ professional thread, optionally anchored
 * to a request/booking/service. `conversationKey` makes creation idempotent so
 * "Message" buttons never spawn duplicate threads.
 *
 * Unread counters are maintained per participant, so the sidebar badge is a
 * single indexed read instead of a scan of every message.
 */

export const MESSAGE_MAX_LENGTH = 4000;

export const sendMessageSchema = z.object({
  body: sanitizedTextSchema.pipe(
    z.string().trim().min(1, "message_empty").max(MESSAGE_MAX_LENGTH, "message_too_long")
  ),
  /** Client-generated id — makes optimistic sends safely retryable. */
  clientId: z.string().trim().min(6).max(64).optional(),
  attachments: z
    .array(z.object({ url: z.string().max(2048), name: z.string().max(200), mimeType: z.string().max(100), sizeBytes: z.number().int().positive() }))
    .max(5)
    .optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const startConversationSchema = z.object({
  /** The *other* party: a professional user id (customer writing) or a customer user id. */
  withUserId: z.string().uuid(),
  requestId: z.string().uuid().optional().nullable(),
  bookingId: z.string().uuid().optional().nullable(),
  serviceId: z.string().uuid().optional().nullable(),
  subject: z.string().trim().max(160).optional().nullable(),
  body: sanitizedTextSchema.pipe(z.string().trim().min(1, "message_empty").max(MESSAGE_MAX_LENGTH, "message_too_long")).optional().nullable(),
});

export type StartConversationInput = z.infer<typeof startConversationSchema>;

const PARTICIPANT_INCLUDE = {
  user: {
    select: {
      id: true,
      role: true,
      identity: { select: { fullName: true, firstName: true, avatarUrl: true } },
      professionalProfile: {
        select: { id: true, slug: true, businessName: true, avatarUrl: true, verificationStatus: true, ratingAverage: true, city: true },
      },
    },
  },
} as const satisfies Prisma.ConversationParticipantInclude;

export const CONVERSATION_INCLUDE = {
  participants: { include: PARTICIPANT_INCLUDE },
  request: { select: { id: true, reference: true, title: true, status: true } },
  booking: { select: { id: true, reference: true, title: true, status: true, scheduledDate: true } },
  service: { select: { id: true, slug: true, title: true } },
} as const satisfies Prisma.ConversationInclude;

export type ConversationRow = Prisma.ConversationGetPayload<{ include: typeof CONVERSATION_INCLUDE }>;

// ─── Reads ───────────────────────────────────────────────────────────────────

export interface ListConversationsInput extends Partial<PaginationInput> {
  actorId: string;
  search?: string;
  unreadOnly?: boolean;
}

export async function listConversations(input: ListConversationsInput) {
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(50, Math.max(1, input.perPage ?? 20));

  const where: Prisma.ConversationWhereInput = {
    isActive: true,
    participants: {
      some: {
        userId: input.actorId,
        ...(input.unreadOnly ? { unreadCount: { gt: 0 } } : {}),
      },
    },
    ...(input.search
      ? {
          OR: [
            { subject: { contains: input.search, mode: "insensitive" } },
            { lastMessagePreview: { contains: input.search, mode: "insensitive" } },
            { participants: { some: { user: { identity: { fullName: { contains: input.search, mode: "insensitive" } } } } } },
          ],
        }
      : {}),
  };

  const [rows, total, unreadTotal] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: CONVERSATION_INCLUDE,
    }),
    prisma.conversation.count({ where }),
    prisma.conversationParticipant.aggregate({
      where: { userId: input.actorId, unreadCount: { gt: 0 } },
      _sum: { unreadCount: true },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      ...row,
      unreadCount: row.participants.find((p) => p.user.id === input.actorId)?.unreadCount ?? 0,
    })),
    unreadTotal: unreadTotal._sum.unreadCount ?? 0,
    ...paginationMeta(page, perPage, total),
  };
}

export async function getConversation(actor: Actor, id: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: CONVERSATION_INCLUDE,
  });
  if (!conversation) throw notFound("Conversation not found.");
  if (!canAccessConversation(actor, conversation)) throw forbidden();
  return conversation;
}

export interface ListMessagesInput extends Partial<PaginationInput> {
  conversationId: string;
  actorId: string;
  /** Cursor for infinite scroll: fetch messages older than this id's timestamp. */
  before?: string;
}

export async function listMessages(input: ListMessagesInput) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    select: { id: true, customerId: true, professionalId: true },
  });
  if (!conversation) throw notFound("Conversation not found.");
  if (conversation.customerId !== input.actorId && conversation.professionalId !== input.actorId) {
    throw forbidden("You are not part of this conversation.");
  }

  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(100, Math.max(1, input.perPage ?? 50));

  let beforeAt: Date | undefined;
  if (input.before) {
    const anchor = await prisma.message.findUnique({ where: { id: input.before }, select: { createdAt: true } });
    beforeAt = anchor?.createdAt;
  }

  const where: Prisma.MessageWhereInput = {
    conversationId: input.conversationId,
    deletedAt: null,
    ...(beforeAt ? { createdAt: { lt: beforeAt } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.message.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { sender: { select: { id: true, role: true, identity: { select: { fullName: true, avatarUrl: true } } } } },
    }),
    prisma.message.count({ where: { conversationId: input.conversationId, deletedAt: null } }),
  ]);

  // Chat renders oldest → newest.
  return {
    items: items.reverse(),
    ...paginationMeta(page, perPage, total),
  };
}

// ─── Writes ──────────────────────────────────────────────────────────────────

function conversationKeyFor(a: string, b: string, context?: string) {
  const [first, second] = [a, b].sort();
  return context ? `u:${first}:${second}:${context}` : `u:${first}:${second}`;
}

export async function startConversation(actor: Actor, input: StartConversationInput) {
  if (!actor) throw forbidden();
  if (input.withUserId === actor.id) throw unprocessable("You cannot message yourself.");

  const other = await prisma.user.findUnique({
    where: { id: input.withUserId },
    select: {
      id: true,
      role: true,
      status: true,
      deletedAt: true,
      professionalProfile: { select: { id: true, verificationStatus: true, availabilityStatus: true } },
    },
  });
  if (!other || other.deletedAt || other.status !== "ACTIVE") throw notFound("This user is not available.");
  if (other.role === "ADMIN") throw forbidden("Administrators cannot be contacted through messaging.");

  // Determine who is the customer and who is the professional in this thread.
  let customerId: string;
  let professionalId: string;
  if (other.role === "PROFESSIONAL") {
    if (actor.role !== "CUSTOMER" && actor.role !== "ADMIN") {
      throw forbidden("Only customers can start a conversation with a professional.");
    }
    customerId = actor.id;
    professionalId = other.id;
  } else if (other.role === "CUSTOMER") {
    if (actor.role !== "PROFESSIONAL" && actor.role !== "ADMIN") {
      throw forbidden("Only professionals can start a conversation with a customer.");
    }
    customerId = other.id;
    professionalId = actor.id;
  } else {
    throw forbidden("This conversation is not allowed.");
  }

  if (
    input.bookingId ||
    input.requestId
  ) {
    // Context must actually involve both parties — prevents threading strangers
    // into somebody else's job.
    if (input.bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: input.bookingId },
        select: { customerId: true, professionalId: true },
      });
      if (!booking || booking.customerId !== customerId || booking.professionalId !== professionalId) {
        throw forbidden("This booking does not belong to this conversation.");
      }
    }
    if (input.requestId) {
      const request = await prisma.serviceRequest.findUnique({
        where: { id: input.requestId },
        select: { customerId: true, offers: { where: { professionalId }, select: { id: true } } },
      });
      const isOwnRequest = request?.customerId === customerId;
      const hasOffered = (request?.offers.length ?? 0) > 0;
      if (!request || !isOwnRequest || !hasOffered) {
        throw forbidden("You can only discuss a request you posted or offered on.");
      }
    }
  }

  const contextPart = input.bookingId ?? input.requestId ?? undefined;
  const key = conversationKeyFor(customerId, professionalId, contextPart);

  const existing = await prisma.conversation.findUnique({ where: { conversationKey: key } });
  if (existing) {
    if (input.body) {
      await postMessage(actor, existing.id, { body: input.body });
    }
    return prisma.conversation.findUnique({ where: { id: existing.id }, include: CONVERSATION_INCLUDE });
  }

  const conversation = await prisma.$transaction(async (tx) => {
    const created = await tx.conversation.create({
      data: {
        conversationKey: key,
        customerId,
        professionalId,
        requestId: input.requestId ?? null,
        bookingId: input.bookingId ?? null,
        serviceId: input.serviceId ?? null,
        subject: input.subject ?? null,
        participants: {
          create: [
            { userId: customerId, role: "CUSTOMER" },
            { userId: professionalId, role: "PROFESSIONAL" },
          ],
        },
      },
      include: CONVERSATION_INCLUDE,
    });

    if (input.body) {
      await createMessageRow(tx, {
        conversationId: created.id,
        senderId: actor.id,
        recipientId: actor.id === customerId ? professionalId : customerId,
        body: input.body,
        participantRows: created.participants.map((p) => ({ id: p.id, userId: p.userId })),
      });
    }
    return created;
  });

  return prisma.conversation.findUnique({ where: { id: conversation.id }, include: CONVERSATION_INCLUDE });
}

async function createMessageRow(
  tx: Prisma.TransactionClient,
  args: {
    conversationId: string;
    senderId: string;
    recipientId: string;
    body: string;
    attachments?: Prisma.InputJsonValue | null;
    clientId?: string | null;
    participantRows: { id: string; userId: string }[];
  }
) {
  const recipient = await tx.user.findUnique({
    where: { id: args.recipientId },
    select: { role: true },
  });
  const base = recipient?.role === "PROFESSIONAL" ? "/professional" : "/dashboard";

  const message = await tx.message.create({
    data: {
      conversationId: args.conversationId,
      senderId: args.senderId,
      body: args.body,
      attachments: args.attachments ?? undefined,
      clientId: args.clientId ?? null,
      status: "SENT",
    },
    include: { sender: { select: { id: true, role: true, identity: { select: { fullName: true, avatarUrl: true } } } } },
  });

  const now = new Date();
  await tx.conversation.update({
    where: { id: args.conversationId },
    data: { lastMessageAt: now, lastMessagePreview: truncate(args.body, 120) },
  });

  // Sender's cursor advances; recipient accrues one unread.
  for (const participant of args.participantRows) {
    if (participant.userId === args.senderId) {
      await tx.conversationParticipant.update({
        where: { id: participant.id },
        data: { lastReadAt: now, lastReadMessageId: message.id, unreadCount: 0 },
      });
    } else {
      await tx.conversationParticipant.update({
        where: { id: participant.id },
        data: { unreadCount: { increment: 1 } },
      });
    }
  }

  await tx.notification.create({
    data: {
      userId: args.recipientId,
      type: "NEW_MESSAGE",
      title: "رسالة جديدة",
      body: truncate(args.body, 100),
      data: { conversationId: args.conversationId, messageId: message.id },
      linkTo: `${base}/messages/${args.conversationId}`,
      channels: { inApp: "sent", email: "skipped", push: "skipped" },
    },
  });

  return message;
}

export async function postMessage(actor: Actor, conversationId: string, input: SendMessageInput) {
  if (!actor) throw forbidden();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, customerId: true, professionalId: true, isActive: true },
  });
  if (!conversation) throw notFound("Conversation not found.");
  if (!canAccessConversation(actor, conversation)) throw forbidden("You are not part of this conversation.");
  if (!conversation.isActive) throw unprocessable("This conversation is closed.");

  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { id: true, userId: true },
  });
  const recipientId = conversation.customerId === actor.id ? conversation.professionalId : conversation.customerId;

  // Idempotency: an optimistic client may retry with the same clientId.
  if (input.clientId) {
    const existing = await prisma.message.findUnique({
      where: { conversationId_clientId: { conversationId, clientId: input.clientId } },
      include: { sender: { select: { id: true, role: true, identity: { select: { fullName: true, avatarUrl: true } } } } },
    });
    if (existing) return existing;
  }

  try {
    return await prisma.$transaction((tx) =>
      createMessageRow(tx, {
        conversationId,
        senderId: actor.id,
        recipientId,
        body: input.body,
        attachments: input.attachments ? (input.attachments as unknown as Prisma.InputJsonValue) : null,
        clientId: input.clientId ?? null,
        participantRows: participants,
      })
    );
  } catch (error) {
    // Unique violation on (conversationId, clientId) means a concurrent retry
    // already landed — return that row instead of surfacing a 409.
    if ((error as { code?: string }).code === "P2002" && input.clientId) {
      const existing = await prisma.message.findUnique({
        where: { conversationId_clientId: { conversationId, clientId: input.clientId } },
        include: { sender: { select: { id: true, role: true, identity: { select: { fullName: true, avatarUrl: true } } } } },
      });
      if (existing) return existing;
    }
    throw error;
  }
}

export async function markConversationRead(actor: Actor, conversationId: string) {
  if (!actor) throw forbidden();
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, customerId: true, professionalId: true },
  });
  if (!conversation) throw notFound("Conversation not found.");
  if (!canAccessConversation(actor, conversation)) throw forbidden();

  const lastMessage = await prisma.message.findFirst({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.conversationParticipant.updateMany({
      where: { conversationId, userId: actor.id },
      data: { unreadCount: 0, lastReadAt: new Date(), lastReadMessageId: lastMessage?.id ?? null },
    }),
    // The other party now sees "read" receipts.
    prisma.message.updateMany({
      where: { conversationId, senderId: actor.id, readAt: null },
      data: { readAt: new Date(), status: "READ" },
    }),
  ]);

  return { conversationId, unreadCount: 0 };
}

export async function unreadMessageCount(actorId: string) {
  const row = await prisma.conversationParticipant.aggregate({
    where: { userId: actorId },
    _sum: { unreadCount: true },
  });
  return row._sum.unreadCount ?? 0;
}

export async function archiveConversation(actor: Actor, conversationId: string) {
  if (!actor) throw forbidden();
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, customerId: true, professionalId: true },
  });
  if (!conversation) throw notFound("Conversation not found.");
  if (!canAccessConversation(actor, conversation)) throw forbidden();
  // Archiving hides it for the actor only; the thread stays intact for the
  // other party and for moderation.
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId: actor.id },
    data: { isMuted: true },
  });
  return { conversationId, archived: true };
}

/** Admin moderation helper — used when a conversation is reported. */
export async function adminDeactivateConversation(adminId: string, conversationId: string, reason: string) {
  const [conversation] = await prisma.$transaction([
    prisma.conversation.update({ where: { id: conversationId }, data: { isActive: false } }),
    prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: "CONVERSATION_DEACTIVATED",
        targetType: "CONVERSATION",
        targetId: conversationId,
        metadata: { reason },
      },
    }),
  ]);
  return conversation;
}


