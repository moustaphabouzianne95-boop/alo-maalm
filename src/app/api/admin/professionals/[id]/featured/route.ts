import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { setProfessionalFeatured } from "@/server/users/service";

const schema = z.object({ isFeatured: z.coerce.boolean() });

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["POST"], auth: ["ADMIN"], bodySchema: schema, rateLimit: false },
  async ({ params, body, user }) => ok(await setProfessionalFeatured(user!.id, params.id!, body.isFeatured))
);
