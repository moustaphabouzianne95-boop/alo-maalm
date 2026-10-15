import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { forbidden } from "@/lib/api/errors";
import { citySchema } from "@/lib/validation/common";
import { getOwnProfessionalProfile, updateProfessionalProfile } from "@/server/professionals/service";

const schema = z.object({
  businessName: z.string().trim().max(120).nullable().optional(),
  headline: z.string().trim().max(180).nullable().optional(),
  about: z.string().trim().max(4000).nullable().optional(),
  avatarUrl: z.string().trim().max(2048).nullable().optional(),
  coverUrl: z.string().trim().max(2048).nullable().optional(),
  city: citySchema.optional(),
  neighborhood: z.string().trim().max(80).nullable().optional(),
  serviceRadiusKm: z.coerce.number().int().min(1).max(300).optional(),
  yearsExperience: z.coerce.number().int().min(0).max(60).optional(),
  languages: z.array(z.string().trim().min(2).max(8)).max(6).optional(),
  website: z.string().trim().url().max(300).nullable().optional(),
  phonePublic: z.coerce.boolean().optional(),
  publicPhone: z.string().trim().max(20).nullable().optional(),
  availabilityStatus: z.enum(["AVAILABLE", "BUSY", "UNAVAILABLE"]).optional(),
  acceptsUrgentJobs: z.coerce.boolean().optional(),
});

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET", "PATCH"], auth: ["PROFESSIONAL", "ADMIN"], bodySchema: schema.optional(), rateLimit: "api" },
  async ({ body, req, user }) => {
    // Only the account owner may read or edit their trade profile.
    if (req.method === "GET") return ok(await getOwnProfessionalProfile(user!.id));
    if (user!.role !== "PROFESSIONAL") throw forbidden("Only professional accounts have a trade profile.");
    await updateProfessionalProfile(user!.id, body ?? {});
    return ok(await getOwnProfessionalProfile(user!.id));
  }
);
