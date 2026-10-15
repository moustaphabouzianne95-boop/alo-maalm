import { NextResponse, type NextRequest } from "next/server";
import { readLocalUpload } from "@/lib/storage";
import { ErrorCode, ERROR_STATUS } from "@/lib/api/errors";

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

/**
 * Serves files written by the local storage provider.
 *
 * `next.config.ts` rewrites `/uploads/:path*` here so uploaded media has one
 * URL shape regardless of whether the deployment stores files on disk,
 * Cloudinary or S3 (the other two providers return absolute URLs and never hit
 * this route). The key is re-validated against traversal before it is read.
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const key = (path ?? []).join("/");
  const file = await readLocalUpload(key);

  if (!file) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCode.NOT_FOUND, message: "File not found." } },
      { status: ERROR_STATUS[ErrorCode.NOT_FOUND] }
    );
  }

  // The stored file has no sidecar metadata, so the MIME type is derived from
  // the extension — the upload endpoint already refused anything outside the
  // image allow-list, which is what makes this safe.
  const mimeType = MIME_BY_EXTENSION[key.slice(key.lastIndexOf(".") + 1).toLowerCase()] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(file.buffer) as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(file.size),
      // Uploaded media is immutable (keyed by timestamp + random suffix).
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
