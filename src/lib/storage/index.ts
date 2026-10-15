import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, writeFile, unlink, stat } from "node:fs/promises";
import { env, allowedImageMimeTypes, maxUploadBytes } from "@/lib/env";
import { ApiError, ErrorCode } from "@/lib/api/errors";
import { slugify } from "@/lib/utils/slug";
import { optionalImport } from "@/lib/utils/optional-import";

/** Kept in a constant so no bundler tries to resolve the optional SDK. */
const S3_SDK = "@aws-sdk/client-s3";

/**
 * Pluggable file storage.
 *
 * `STORAGE_PROVIDER=local` (dev/default) writes under `public/uploads` and is
 * served through `/api/uploads/[...]` so the same code path works for
 * Cloudinary or an S3-compatible bucket later — call sites only ever see a
 * public URL.
 */
export interface StoredFile {
  url: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
  provider: StorageProviderName;
}

export type StorageProviderName = "local" | "cloudinary" | "s3";

export interface StorageProvider {
  readonly name: StorageProviderName;
  put(input: { file: File; folder: string; maxWidth?: number }): Promise<StoredFile>;
  remove(key: string): Promise<void>;
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateUpload(file: File, maxFiles?: number, currentCount = 0) {
  if (!file || file.size === 0) {
    throw new ApiError(ErrorCode.BAD_REQUEST, "The uploaded file is empty.");
  }
  if (maxFiles != null && currentCount >= maxFiles) {
    throw new ApiError(ErrorCode.BAD_REQUEST, `You can upload at most ${maxFiles} files.`);
  }
  const normalizedType = file.type.toLowerCase();
  if (!allowedImageMimeTypes.includes(normalizedType)) {
    throw new ApiError(
      ErrorCode.UNSUPPORTED_MEDIA_TYPE,
      `Only the following image types are accepted: ${allowedImageMimeTypes.join(", ")}.`
    );
  }
  if (file.size > maxUploadBytes) {
    throw new ApiError(
      ErrorCode.PAYLOAD_TOO_LARGE,
      `The image must be smaller than ${env.MAX_UPLOAD_MB} MB.`
    );
  }
  return normalizedType;
}

class LocalStorageProvider implements StorageProvider {
  readonly name = "local" as const;

  private root() {
    return path.isAbsolute(env.UPLOAD_DIR) ? env.UPLOAD_DIR : path.join(process.cwd(), env.UPLOAD_DIR);
  }

  async put({ file, folder }: { file: File; folder: string; maxWidth?: number }) {
    const mimeType = validateUpload(file);
    const ext = EXT_BY_MIME[mimeType] ?? "bin";
    const safeFolder = slugify(folder, "uploads");
    const key = `${safeFolder}/${Date.now().toString(36)}-${randomUUID().slice(0, 8)}.${ext}`;
    const absolute = path.join(this.root(), key);

    // Path traversal guard: the resolved target must stay inside the root.
    const resolvedRoot = path.resolve(this.root());
    if (!path.resolve(absolute).startsWith(resolvedRoot + path.sep)) {
      throw new ApiError(ErrorCode.BAD_REQUEST, "Invalid upload path.");
    }

    await mkdir(path.dirname(absolute), { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(absolute, bytes);

    return {
      url: `/uploads/${key}`,
      key,
      mimeType,
      sizeBytes: bytes.byteLength,
      provider: this.name,
    };
  }

  async remove(key: string) {
    const absolute = path.join(this.root(), key);
    const resolvedRoot = path.resolve(this.root());
    if (!path.resolve(absolute).startsWith(resolvedRoot + path.sep)) return;
    await unlink(absolute).catch(() => undefined);
  }
}

class CloudinaryProvider implements StorageProvider {
  readonly name = "cloudinary" as const;

  async put({ file, folder }: { file: File; folder: string }) {
    validateUpload(file);
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new ApiError(ErrorCode.SERVICE_UNAVAILABLE, "Cloudinary is not configured on this server.");
    }
    const form = new FormData();
    form.append("file", file);
    form.append("folder", `alomaalem/${folder}`);
    form.append("upload_preset", process.env.CLOUDINARY_UPLOAD_PRESET ?? "");

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString("base64")}`,
      },
      body: form,
    });
    if (!response.ok) {
      throw new ApiError(ErrorCode.SERVICE_UNAVAILABLE, "The upload provider rejected the file.");
    }
    const json = (await response.json()) as { secure_url: string; public_id: string; bytes: number; format: string };
    return {
      url: json.secure_url,
      key: json.public_id,
      mimeType: `image/${json.format === "jpg" ? "jpeg" : json.format}`,
      sizeBytes: json.bytes,
      provider: this.name,
    };
  }

  async remove(key: string) {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return;
    const form = new FormData();
    form.append("public_id", key);
    await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString("base64")}`,
      },
      body: form,
    }).catch(() => undefined);
  }
}

class S3Provider implements StorageProvider {
  readonly name = "s3" as const;

  private assertConfigured() {
    if (!env.S3_BUCKET || !env.S3_REGION || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      throw new ApiError(ErrorCode.SERVICE_UNAVAILABLE, "S3 storage is not configured on this server.");
    }
  }

  async put({ file, folder }: { file: File; folder: string }) {
    this.assertConfigured();
    validateUpload(file);
    // Loaded lazily so the AWS SDK stays an optional dependency.
    const aws = await optionalImport<{
      S3Client: new (cfg: Record<string, unknown>) => { send: (cmd: unknown) => Promise<unknown> };
      PutObjectCommand: new (input: Record<string, unknown>) => unknown;
    }>(S3_SDK);
    if (!aws) throw new ApiError(ErrorCode.SERVICE_UNAVAILABLE, "The S3 SDK is not installed.");

    const client = new aws.S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
    });
    const ext = EXT_BY_MIME[file.type.toLowerCase()] ?? "bin";
    const key = `${slugify(folder, "uploads")}/${Date.now().toString(36)}-${randomUUID().slice(0, 8)}.${ext}`;
    await client.send(
      new aws.PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: Buffer.from(await file.arrayBuffer()),
        ContentType: file.type,
      })
    );
    const host = env.S3_ENDPOINT
      ? `${env.S3_ENDPOINT.replace(/\/$/, "")}/${env.S3_BUCKET}/${key}`
      : `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`;
    return { url: host, key, mimeType: file.type, sizeBytes: file.size, provider: this.name };
  }

  async remove(key: string) {
    if (!env.S3_BUCKET) return;
    const aws = await optionalImport<{
      S3Client: new (cfg: Record<string, unknown>) => { send: (cmd: unknown) => Promise<unknown> };
      DeleteObjectCommand: new (input: Record<string, unknown>) => unknown;
    }>(S3_SDK);
    if (!aws) return;
    const client = new aws.S3Client({
      region: env.S3_REGION,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
    });
    await client.send(new aws.DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key })).catch(() => undefined);
  }
}

let provider: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (provider) return provider;
  switch (env.STORAGE_PROVIDER) {
    case "cloudinary":
      provider = new CloudinaryProvider();
      break;
    case "s3":
      provider = new S3Provider();
      break;
    default:
      provider = new LocalStorageProvider();
  }
  return provider;
}

export async function uploadImage(file: File, folder: string) {
  return getStorage().put({ file, folder });
}

export async function deleteStoredFile(key: string) {
  return getStorage().remove(key);
}

/** Reads a locally stored upload (used by the `/api/uploads` route). */
export async function readLocalUpload(key: string) {
  const root = path.isAbsolute(env.UPLOAD_DIR) ? env.UPLOAD_DIR : path.join(process.cwd(), env.UPLOAD_DIR);
  const absolute = path.resolve(root, key);
  if (!absolute.startsWith(path.resolve(root) + path.sep)) return null;
  try {
    const info = await stat(absolute);
    if (!info.isFile()) return null;
    const { readFile } = await import("node:fs/promises");
    return { buffer: await readFile(absolute), size: info.size };
  } catch {
    return null;
  }
}
