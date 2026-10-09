import { Redis } from "@upstash/redis";
import crypto from "node:crypto";

// Lazily-initialized Upstash Redis client. When the environment variables are
// absent (e.g. a fresh local checkout), every cache helper becomes a harmless
// no-op so the API keeps working without a Redis instance.
let redisClient: Redis | null = null;
let redisInitialized = false;

export function getRedis(): Redis | null {
  if (redisInitialized) return redisClient;
  redisInitialized = true;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (url && token) {
    try {
      redisClient = new Redis({ url, token });
      console.log("[cache] Upstash Redis client initialized.");
    } catch (err) {
      console.warn("[cache] Failed to initialize Upstash Redis client:", err);
      redisClient = null;
    }
  } else {
    console.warn("[cache] Upstash env vars not set; response caching is disabled.");
  }

  return redisClient;
}

// Deterministic per-document / per-input cache entries survive for 60 days so a
// re-analysis of the same source returns the identical result without an AI call.
export const CACHE_TTL_SECONDS = 60 * 60 * 24 * 60;

export function cacheKey(route: string, payload: unknown): string {
  const serialized = typeof payload === "string" ? payload : JSON.stringify(payload ?? null);
  const hash = crypto.createHash("sha256").update(serialized).digest("hex");
  return `bahthos:ai:v1:${route}:${hash}`;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const value = await redis.get<T>(key);
    return value ?? null;
  } catch (err) {
    console.warn("[cache] get failed:", err);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number = CACHE_TTL_SECONDS): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (err) {
    console.warn("[cache] set failed:", err);
  }
}
