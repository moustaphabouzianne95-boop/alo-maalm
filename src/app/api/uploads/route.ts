import { withApi } from "@/lib/api/with-api";
import { created } from "@/lib/api/respond";
import { unprocessable } from "@/lib/api/errors";
import { uploadImage, validateUpload } from "@/lib/storage";
import { RATE_LIMIT_BUCKETS } from "@/lib/rate-limit";

/**
 * Authenticated image upload used by service covers and profile photos.
 * Size and MIME are checked before anything is written (§51).
 */
export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["POST"], auth: [], rateLimit: RATE_LIMIT_BUCKETS.upload, rateLimitMax: 20 },
  async ({ req }) => {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw unprocessable("An image file is required.", { field: "file" });
    const folder = String(form.get("folder") ?? "images").slice(0, 40);
    validateUpload(file);
    const stored = await uploadImage(file, folder === "documents" ? "images" : folder);
    return created({ url: stored.url, key: stored.key });
  }
);
