import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok, created } from "@/lib/api/respond";
import { forbidden } from "@/lib/api/errors";
import { emailSchema, moroccanPhoneSchema, passwordSchema, citySchema } from "@/lib/validation/common";
import { registerUser } from "@/server/auth/service";
import { createSession } from "@/lib/auth/session";
import { RATE_LIMIT_BUCKETS } from "@/lib/rate-limit";

const registerSchema = z
  .object({
    firstName: z.string().trim().min(2, "first_name_required").max(60),
    lastName: z.string().trim().min(1, "last_name_required").max(60),
    email: emailSchema,
    phone: moroccanPhoneSchema,
    password: passwordSchema,
    /** ADMIN is deliberately absent from the enum and rejected again below. */
    role: z.enum(["CUSTOMER", "PROFESSIONAL"]),
    city: citySchema.optional().nullable(),
    locale: z.enum(["AR", "FR", "EN"]).optional(),
    businessName: z.string().trim().max(120).optional().nullable(),
    headline: z.string().trim().max(180).optional().nullable(),
    termsAccepted: z
      .union([z.boolean(), z.string()])
      .transform((v) => v === true || v === "true" || v === "on")
      .refine((v) => v, "terms_required"),
  })
  .superRefine((data, ctx) => {
    if (data.role === "PROFESSIONAL" && !data.city) {
      ctx.addIssue({ code: "custom", path: ["city"], message: "city_required_for_professional" });
    }
  });

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  {
    methods: ["POST"],
    auth: null,
    bodySchema: registerSchema,
    rateLimit: RATE_LIMIT_BUCKETS.auth,
    rateLimitMax: 8,
  },
  async ({ body, req, ip }) => {
    // Defence in depth: an administrator account can never be created here,
    // even if the enum above were ever widened by mistake.
    if ((body.role as string) === "ADMIN") throw forbidden();

    const result = await registerUser({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      password: body.password,
      role: body.role,
      city: body.city ?? null,
      locale: body.locale,
      businessName: body.businessName ?? null,
      headline: body.headline ?? null,
      ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    // Sign the new account straight in — no forced round-trip to /login.
    await createSession(result.user.id, result.user.role, result.user.email, {
      ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    return created(result);
  }
);
