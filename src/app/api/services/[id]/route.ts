import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { unauthenticated } from "@/lib/api/errors";
import {
  getServicePublic,
  updateServiceSchema,
  updateService,
  deleteService,
  incrementServiceView,
} from "@/server/services/service";
import { getSession } from "@/lib/auth/session";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  {
    methods: ["GET", "PATCH", "DELETE"],
    auth: null,
    bodySchema: updateServiceSchema.optional(),
    rateLimit: "api",
  },
  async ({ params, body, req }) => {
    if (req.method === "GET") {
      const service = await getServicePublic(params.id!);
      // Best-effort view counter: a read must never fail because a stat write did.
      void incrementServiceView(service.id);
      return ok(service);
    }

    const session = await getSession();
    if (!session) throw unauthenticated();
    if (req.method === "PATCH") return ok(await updateService(session.user, params.id!, body!));
    return ok(await deleteService(session.user, params.id!));
  }
);
