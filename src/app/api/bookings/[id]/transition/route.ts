import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { transitionBooking, cancelBooking } from "@/server/bookings/service";

/**
 * Booking state machine (§16). The requested status is validated against the
 * transition table *and* against the caller's role inside the service, so a
 * professional cannot self-complete a job and a stranger cannot confirm one.
 */
const schema = z.object({
  status: z.enum(["CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  reason: z.string().trim().max(500).optional().nullable(),
  scheduledDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date")
    .optional()
    .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : undefined)),
  scheduledTime: z.string().trim().max(24).optional(),
});

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["POST"], auth: [], bodySchema: schema, rateLimit: "api" },
  async ({ params, body, user }) => {
    if (body.status === "CANCELLED") {
      return ok(await cancelBooking(user, params.id!, body.reason ?? null));
    }
    return ok(
      await transitionBooking(user, params.id!, {
        status: body.status,
        reason: body.reason ?? null,
        scheduledDate: body.scheduledDate,
        scheduledTime: body.scheduledTime,
      })
    );
  }
);
