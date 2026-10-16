import { z } from "zod";

/**
 * Single source of truth for runtime configuration.
 *
 * Validated once at module load so a missing/invalid secret fails fast with a
 * readable message instead of surfacing as a mysterious runtime error.
 * Only values prefixed with `NEXT_PUBLIC_` are ever exposed to the browser.
 */
const booleanish = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_READ_URL: z.string().optional(),

  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_SESSION_MAX_AGE: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  AUTH_COOKIE_NAME: z.string().min(1).default("alomaalem_session"),

  RATE_LIMIT_DRIVER: z.enum(["memory", "redis"]).default("memory"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  REDIS_URL: z.string().optional(),

  STORAGE_PROVIDER: z.enum(["local", "cloudinary", "s3", "blob"]).default("local"),
  UPLOAD_DIR: z.string().default("./public/uploads"),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().max(25).default(5),
  ALLOWED_IMAGE_TYPES: z.string().default("image/jpeg,image/png,image/webp"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  /** Set automatically when a Vercel Blob store is connected. */
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  BLOB_STORE_ID: z.string().optional(),

  PAYMENTS_ENABLED: booleanish,
  PLATFORM_COMMISSION_RATE: z.coerce.number().min(0).max(1).default(0.1),

  EMAIL_PROVIDER: z.enum(["console", "smtp", "resend"]).default("console"),
  SMTP_FROM: z.string().optional(),

  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("ألو المعلم"),
  SEED_PASSWORD: z.string().default("Demo@12345"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `❌ Invalid environment configuration for ألو المعلم:\n${issues}\n\n` +
        `Copy .env.example to .env and fill in the values.`
    );
  }
  return parsed.data;
}

export const env: Env = loadEnv();

export const isProduction = env.APP_ENV === "production";
export const isDevelopment = env.APP_ENV === "development";
export const isTest = env.NODE_ENV === "test";

export const allowedImageMimeTypes = env.ALLOWED_IMAGE_TYPES.split(",")
  .map((t) => t.trim())
  .filter(Boolean);

export const maxUploadBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
