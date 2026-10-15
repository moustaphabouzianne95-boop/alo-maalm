/**
 * Rate limiting with a pluggable driver.
 *
 * The MVP ships an in-memory fixed-window limiter (fine for a single instance).
 * Set `RATE_LIMIT_DRIVER=redis` + `REDIS_URL` to swap in a shared store without
 * touching any call site — `createRateLimiter` resolves the driver at runtime.
 */

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Milliseconds until the window resets. */
  resetInMs: number;
  resetAt: Date;
}

export interface RateLimiter {
  check(key: string, limit?: number, windowMs?: number): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
  /** Drops every counter. Used by the test harness and the admin reset route. */
  resetAll?(): Promise<void>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

function memoryDriver(): RateLimiter {
  const buckets = new Map<string, Bucket>();

  // Opportunistic sweep so an idle server does not leak memory.
  let lastSweep = Date.now();
  function sweep() {
    const now = Date.now();
    if (now - lastSweep < 60_000) return;
    lastSweep = now;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  return {
    async check(key, limit = 60, windowMs = 60_000) {
      sweep();
      const now = Date.now();
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return {
          success: true,
          limit,
          remaining: limit - 1,
          resetInMs: windowMs,
          resetAt: new Date(now + windowMs),
        };
      }
      bucket.count += 1;
      const success = bucket.count <= limit;
      return {
        success,
        limit,
        remaining: Math.max(0, limit - bucket.count),
        resetInMs: Math.max(0, bucket.resetAt - now),
        resetAt: new Date(bucket.resetAt),
      };
    },
    async reset(key) {
      buckets.delete(key);
    },
    async resetAll() {
      buckets.clear();
    },
  };
}

/**
 * One shared in-memory limiter for the process.
 *
 * Constructing `memoryDriver()` per call would hand every request a fresh bucket
 * map, i.e. no rate limiting at all — both the default path and the Redis
 * fallback must reuse this singleton.
 */
let memoryLimiter: RateLimiter | null = null;
function sharedMemoryDriver(): RateLimiter {
  memoryLimiter ||= memoryDriver();
  return memoryLimiter;
}

/** The slice of the ioredis client this driver actually uses. */
interface RedisLike {
  eval(script: string, keys: number, ...args: (string | number)[]): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  scan(cursor: string, ...args: (string | number)[]): Promise<[string, string[]]>;
}

let redisDriverPromise: Promise<RateLimiter> | null = null;

async function redisDriver(url: string): Promise<RateLimiter> {
  if (!redisDriverPromise) {
    redisDriverPromise = (async () => {
      // Lazy import keeps `ioredis` optional — it is only installed when the
      // Redis driver is actually selected.
      const { default: Redis } = (await import("ioredis")) as unknown as {
        default: new (url: string) => RedisLike;
      };
      const client = new Redis(url);
      // Fixed-window counter, atomic via Lua so concurrent requests agree.
      const script = `
        local key = KEYS[1]
        local limit = tonumber(ARGV[1])
        local window = tonumber(ARGV[2])
        local current = tonumber(redis.call('INCR', key) or 1)
        if current == 1 then redis.call('PEXPIRE', key, window) end
        local ttl = redis.call('PTTL', key)
        if ttl < 0 then ttl = window end
        return {current, ttl}
      `;
      const driver: RateLimiter = {
        async check(key: string, limit = 60, windowMs = 60_000): Promise<RateLimitResult> {
          const [count, ttl] = (await client.eval(script, 1, key, limit, windowMs)) as [number, number];
          return {
            success: count <= limit,
            limit,
            remaining: Math.max(0, limit - count),
            resetInMs: ttl,
            resetAt: new Date(Date.now() + ttl),
          };
        },
        async reset(key: string) {
          await client.del(key);
        },
        async resetAll() {
          // SCAN, never KEYS: KEYS blocks the server on a large keyspace.
          let cursor = "0";
          do {
            const [next, keys] = await client.scan(cursor, "MATCH", "rl:*", "COUNT", 500);
            cursor = next;
            if (keys.length) await client.del(...keys);
          } while (cursor !== "0");
        },
      };
      return driver;
    })().catch((error) => {
      // Never take the app down because Redis is unreachable: degrade to memory.
      console.error("[rate-limit] Redis driver failed, falling back to memory:", error);
      redisDriverPromise = null;
      return sharedMemoryDriver();
    });
  }
  return redisDriverPromise;
}

let instance: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  const driver = process.env.RATE_LIMIT_DRIVER ?? "memory";
  if (driver === "redis" && process.env.REDIS_URL) {
    // Resolved lazily by `rateLimit`; keep a thin sync wrapper here.
    const wrapper: RateLimiter = {
      async check(key: string, limit?: number, windowMs?: number) {
        const real = await redisDriver(process.env.REDIS_URL!);
        return real.check(key, limit, windowMs);
      },
      async reset(key: string) {
        const real = await redisDriver(process.env.REDIS_URL!);
        return real.reset(key);
      },
      async resetAll() {
        const real = await redisDriver(process.env.REDIS_URL!);
        return real.resetAll?.();
      },
    };
    return wrapper;
  }
  instance ||= sharedMemoryDriver();
  return instance;
}

/** Named limiters so different endpoint families don't share a budget. */
export const RATE_LIMIT_BUCKETS = {
  auth: "auth",
  api: "api",
  upload: "upload",
  contact: "contact",
  message: "message",
} as const;

export async function rateLimit(
  bucket: keyof typeof RATE_LIMIT_BUCKETS | string,
  identifier: string,
  limit?: number,
  windowMs?: number
): Promise<RateLimitResult> {
  const configured = Number(
    bucket === "auth" ? process.env.AUTH_RATE_LIMIT_MAX : process.env.RATE_LIMIT_MAX
  );
  const max = limit ?? (Number.isFinite(configured) && configured > 0 ? configured : 60);
  const configuredWindow = Number(process.env.RATE_LIMIT_WINDOW_MS);
  const window = windowMs ?? (Number.isFinite(configuredWindow) && configuredWindow > 0 ? configuredWindow : 60_000);
  return getRateLimiter().check(`rl:${bucket}:${identifier}`, max, window);
}

/**
 * Clears every counter. Exposed through an admin-only route so the test harness
 * can run repeatedly without tripping the (deliberately tight) auth limits.
 */
export async function resetAllRateLimits(): Promise<void> {
  await getRateLimiter().resetAll?.();
}
