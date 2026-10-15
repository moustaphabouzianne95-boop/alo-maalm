import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { getPublicProfessionalBySlug } from "@/server/professionals/service";
import { reviewSummary } from "@/server/reviews/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET"], auth: null, rateLimit: "api" },
  async ({ params }) => {
    const profile = await getPublicProfessionalBySlug(params.slug!);
    const reviews = await reviewSummary(profile.id);
    return ok({ ...profile, reviews });
  }
);
