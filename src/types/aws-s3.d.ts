/**
 * Minimal ambient types for the *optional* `@aws-sdk/client-s3` dependency.
 *
 * `S3Provider` loads the SDK lazily at runtime and degrades with a clear
 * SERVICE_UNAVAILABLE error when it is absent, so the package is deliberately
 * not installed here. These declarations keep `tsc` honest about the shape we
 * use without pulling the full SDK into every build.
 */
declare module "@aws-sdk/client-s3" {
  export interface S3ClientConfig {
    region?: string;
    endpoint?: string;
    credentials?: { accessKeyId: string; secretAccessKey: string };
    forcePathStyle?: boolean;
  }

  export class S3Client {
    constructor(config?: S3ClientConfig);
    send(command: unknown): Promise<unknown>;
    destroy(): void;
  }

  export class PutObjectCommand {
    constructor(input: Record<string, unknown>);
  }

  export class DeleteObjectCommand {
    constructor(input: Record<string, unknown>);
  }

  export class GetObjectCommand {
    constructor(input: Record<string, unknown>);
  }
}
