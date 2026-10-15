import type { Prisma, ReportReason, ReportStatus, ReportTargetType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { notFound, forbidden, conflict } from "@/lib/api/errors";
import { paginationMeta, type PaginationInput, sanitizedTextSchema } from "@/lib/validation/common";
import { makeReference } from "@/lib/utils";
import { createNotifications } from "@/server/notifications/service";

/**
 * Trust & safety reports (§25).
 *
 * Any signed-in user can report a professional, service, review, request,
 * offer or message. Reports are de-duplicated per reporter, and every admin
 * decision is written to the audit log and notified back to the reporter.
 */

export const createReportSchema = z.object({
  targetType: z.enum(["USER", "PROFESSIONAL", "SERVICE", "REVIEW", "REQUEST", "OFFER", "MESSAGE"]),
  targetId: z.string().uuid("invalid_id"),
  reason: z.enum(["SPAM", "FRAUD", "INAPPROPRIATE", "HARASSMENT", "FAKE_PROFILE", "OTHER"]),
  details: sanitizedTextSchema.pipe(z.string().trim().max(2000)).optional().nullable(),
  evidence: z.array(z.string().trim().max(2048)).max(5).optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

/** Maps a report target to the user it should be attributed to, so admins can
 * act on the account directly. */
async function resolveSubjectUserId(targetType: ReportTargetType, targetId: string): Promise<string | null> {
  switch (targetType) {
    case "USER":
    case "PROFESSIONAL":
      return targetId;
    case "SERVICE": {
      const row = await prisma.service.findUnique({ where: { id: targetId }, select: { ownerUserId: true } });
      return row?.ownerUserId ?? null;
    }
    case "REQUEST": {
      const row = await prisma.serviceRequest.findUnique({ where: { id: targetId }, select: { customerId: true } });
      return row?.customerId ?? null;
    }
    case "OFFER": {
      const row = await prisma.offer.findUnique({ where: { id: targetId }, select: { professionalId: true } });
      return row?.professionalId ?? null;
    }
    case "REVIEW": {
      const row = await prisma.review.findUnique({ where: { id: targetId }, select: { authorId: true } });
      return row?.authorId ?? null;
    }
    case "MESSAGE": {
      const row = await prisma.message.findUnique({ where: { id: targetId }, select: { senderId: true } });
      return row?.senderId ?? null;
    }
    default:
      return null;
  }
}

async function uniqueReportReference() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const reference = makeReference("RPT");
    const exists = await prisma.report.findUnique({ where: { reference }, select: { id: true } });
    if (!exists) return reference;
  }
  return makeReference("RPT", 8);
}

export async function createReport(reporterId: string, input: CreateReportInput) {
  if (input.targetType === "USER" && input.targetId === reporterId) {
    throw forbidden("You cannot report your own account.");
  }

  const subjectUserId = await resolveSubjectUserId(input.targetType as ReportTargetType, input.targetId);
  if (!subjectUserId) throw notFound("The reported item does not exist.");

  const existing = await prisma.report.findUnique({
    where: {
      reporterId_targetType_targetId: {
        reporterId,
        targetType: input.targetType as ReportTargetType,
        targetId: input.targetId,
      },
    },
    select: { id: true, status: true },
  });
  if (existing) {
    throw conflict("You have already reported this item. Our team is reviewing it.");
  }

  const reference = await uniqueReportReference();
  // Harassment and fraud jump the queue.
  const priority = input.reason === "HARASSMENT" ? 3 : input.reason === "FRAUD" ? 3 : input.reason === "FAKE_PROFILE" ? 2 : 1;

  const report = await prisma.report.create({
    data: {
      reference,
      reporterId,
      targetType: input.targetType as ReportTargetType,
      // The reported *item* id, plus the resolved account behind it.
      targetId: input.targetId,
      subjectUserId,
      reason: input.reason as ReportReason,
      details: input.details ?? null,
      evidence: input.evidence ?? [],
      status: "OPEN",
      priority,
    },
    include: {
      reporter: { select: { id: true, identity: { select: { fullName: true } } } },
      subject: { select: { id: true, role: true, status: true, identity: { select: { fullName: true } }, professionalProfile: { select: { slug: true, businessName: true, verificationStatus: true } } } },
    },
  });

  // Notify moderators.
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
  if (admins.length) {
    await createNotifications(
      admins.map((admin) => ({
        userId: admin.id,
        type: "SYSTEM" as const,
        role: "ADMIN" as const,
        title: "بلاغ جديد",
        body: `${reference} · ${input.reason}`,
        data: { reportId: report.id },
        linkTo: `/admin/reports/${report.id}`,
      }))
    ).catch(() => undefined);
  }

  return report;
}

export interface ListReportsInput extends Partial<PaginationInput> {
  status?: ReportStatus;
  reason?: ReportReason;
  targetType?: ReportTargetType;
  search?: string;
  scope?: "admin" | "mine";
  reporterId?: string;
}

export const REPORT_INCLUDE = {
  reporter: { select: { id: true, email: true, identity: { select: { fullName: true } } } },
  subject: {
    select: {
      id: true,
      role: true,
      status: true,
      email: true,
      identity: { select: { fullName: true } },
      professionalProfile: { select: { id: true, slug: true, businessName: true, verificationStatus: true, ratingAverage: true } },
    },
  },
} as const satisfies Prisma.ReportInclude;

export type ReportRow = Prisma.ReportGetPayload<{ include: typeof REPORT_INCLUDE }>;

export async function listReports(input: ListReportsInput) {
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(50, Math.max(1, input.perPage ?? 15));
  const where: Prisma.ReportWhereInput = {
    ...(input.scope === "mine" && input.reporterId ? { reporterId: input.reporterId } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.targetType ? { targetType: input.targetType } : {}),
    ...(input.search
      ? {
          OR: [
            { reference: { contains: input.search.toUpperCase(), mode: "insensitive" } },
            { details: { contains: input.search, mode: "insensitive" } },
            { subject: { identity: { fullName: { contains: input.search, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [items, total, byStatus] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: REPORT_INCLUDE,
    }),
    prisma.report.count({ where }),
    prisma.report.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) as Record<string, number>;
  return { items, counts, ...paginationMeta(page, perPage, total) };
}

export async function getReport(id: string) {
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      ...REPORT_INCLUDE,
      assignedTo: { select: { id: true, identity: { select: { fullName: true } } } },
      resolvedBy: { select: { id: true, identity: { select: { fullName: true } } } },
    },
  });
  if (!report) throw notFound("Report not found.");
  return report;
}

export const REPORT_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  OPEN: ["INVESTIGATING", "RESOLVED", "DISMISSED"],
  INVESTIGATING: ["RESOLVED", "DISMISSED", "OPEN"],
  RESOLVED: [],
  DISMISSED: ["OPEN"],
};

export async function updateReportStatus(
  adminId: string,
  id: string,
  status: ReportStatus,
  input: { resolution?: string | null; actionTaken?: string | null } = {}
) {
  const report = await prisma.report.findUnique({ where: { id }, select: { id: true, status: true, reporterId: true, reference: true } });
  if (!report) throw notFound("Report not found.");
  if (!REPORT_TRANSITIONS[report.status]?.includes(status)) {
    throw conflict(`A report cannot move from ${report.status} to ${status}.`);
  }

  const isFinal = status === "RESOLVED" || status === "DISMISSED";

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.report.update({
      where: { id },
      data: {
        status,
        ...(isFinal ? { resolvedById: adminId, resolvedAt: new Date() } : {}),
        ...(input.resolution !== undefined ? { resolution: input.resolution } : {}),
        ...(input.actionTaken !== undefined ? { actionTaken: input.actionTaken } : {}),
      },
      include: REPORT_INCLUDE,
    });
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: `REPORT_${status}`,
        targetType: "REPORT",
        targetId: id,
        metadata: { from: report.status, to: status, resolution: input.resolution ?? null },
      },
    });
    if (isFinal) {
      await tx.notification.create({
        data: {
          userId: report.reporterId,
          type: "REPORT_RESOLVED",
          title: "تمت معالجة بلاغك",
          body: `البلاغ ${report.reference}: ${status === "RESOLVED" ? "تم الحل" : "تم الرفض"}`,
          data: { reportId: id },
          linkTo: "/dashboard/settings",
          channels: { inApp: "sent", email: "skipped", push: "skipped" },
        },
      });
    }
    return row;
  });

  return updated;
}

export async function assignReport(adminId: string, id: string, assigneeId: string | null) {
  const updated = await prisma.report.update({
    where: { id },
    data: { assignedToId: assigneeId, ...(assigneeId ? { status: "INVESTIGATING" as ReportStatus } : {}) },
    include: REPORT_INCLUDE,
  });
  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "REPORT_ASSIGNED",
      targetType: "REPORT",
      targetId: id,
      metadata: { assigneeId },
    },
  });
  return updated;
}
