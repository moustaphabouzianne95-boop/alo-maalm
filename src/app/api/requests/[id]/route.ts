import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { getRequest, updateRequestSchema, updateRequest, deleteRequest, incrementRequestView } from "@/server/requests/service";
import { getSession } from "@/lib/auth/session";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET", "PATCH", "DELETE"], auth: [], bodySchema: updateRequestSchema.optional(), rateLimit: "api" },
  async ({ params, body, req, user }) => {
    if (req.method === "GET") {
      const request = await getRequest(user, params.id!);
      void incrementRequestView(request.id);
      return ok(request);
    }
    if (req.method === "PATCH") return ok(await updateRequest(user, params.id!, body!));
    return ok(await deleteRequest(user, params.id!));
  }
);
