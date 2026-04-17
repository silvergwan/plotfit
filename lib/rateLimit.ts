// rateLimit.ts

import { redis, connectRedis } from "@/lib/redis";

const WINDOW_SECONDS = 60; // 1분
const MAX_REQUESTS = 5; // 1분에 최대 5회

export async function checkRateLimit(ip: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}> {
  await connectRedis();

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
    remaining: MAX_REQUESTS - current,
    resetInSeconds,
  };
}
