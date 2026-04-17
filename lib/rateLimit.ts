import { redis } from "@/lib/redis";

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 5;

export async function checkRateLimit(ip: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}> {
  const key = `rate_limit:${ip}`;

  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }

  const ttl = await redis.ttl(key);
  const resetInSeconds = ttl > 0 ? ttl : 0;

  if (current > MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, MAX_REQUESTS - current),
    resetInSeconds,
  };
}
