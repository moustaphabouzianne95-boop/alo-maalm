import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok, created } from "@/lib/api/respond";
import { unprocessable } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { uploadImage, validateUpload } from "@/lib/storage";
import { RATE_LIMIT_BUCKETS } from "@/lib/rate-limit";

/**
 * Identity / business documents for professional verification (§6).
 *
 * GET  → the caller's own documents (admin sees any user's via ?userId=)
 * POST → multipart upload, validated for size + MIME before it touches disk
 */
const ALLOWED_TYPES = ["CIN", "PASSPORT", "BUSINESS_REGISTRATION", "CERTIFICATE", "INSURANCE", "OTHER"] as const;

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  {
    methods: ["GET", "POST"],
    auth: [],
    rateLimit: RATE_LIMIT_BUCKETS.upload,
    rateLimitMax: 12,
  },
  async ({ req, user }) => {
    if (req.method === "GET") {
      const targetUserId = user!.role === "ADMIN" ? (req.nextUrl.searchParams.get("userId") ?? user!.id) : user!.id;
      const documents = await prisma.verificationDocument.findMany({
        where: { userId: targetUserId },
        orderBy: { createdAt: "desc" },
      });
      return ok(documents);
    }

    const form = await req.formData();
    const file = form.get("file");
    // "ID_CARD" is accepted as an alias for the Moroccan national id (CIN).
    if (!(file instanceof File)) throw unprocessable("A document file is required.", { field: "file" });
    const requested = String(form.get("type") ?? "OTHER").toUpperCase();
    const type = (requested === "ID_CARD" ? "CIN" : requested) as (typeof ALLOWED_TYPES)[number];
    if (!(ALLOWED_TYPES as readonly string[]).includes(type)) {
      throw unprocessable("Unknown document type.", { field: "type" });
    }

    validateUpload(file, 1);
    const stored = await uploadImage(file, "documents");

    const profile = await prisma.professionalProfile.findUnique({
      where: { userId: user!.id },
      select: { id: true },
    });

    const document = await prisma.verificationDocument.create({
      data: {
        userId: user!.id,
        professionalId: profile?.id ?? null,
        type,
        status: "PENDING",
        fileUrl: stored.url,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      },
    });

    // Uploading a document moves a rejected professional back into the queue.
    if (profile) {
      const current = await prisma.professionalProfile.findUnique({
        where: { id: profile.id },
        select: { verificationStatus: true },
      });
      if (current?.verificationStatus === "REJECTED") {
        await prisma.professionalProfile.update({
          where: { id: profile.id },
          data: { verificationStatus: "PENDING", verificationNote: null },
        });
      }
    }

    return created(document);
  }
);
