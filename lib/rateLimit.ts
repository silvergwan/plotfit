import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

export const MAX_REQUESTS = 5;

// SDK의 고정 윈도우는 첫 요청 시점이 아닌 매분 경계에서 초기화된다.
// 모듈 범위에서 재사용하여 이미 차단한 IP의 캐시도 활용한다.
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(MAX_REQUESTS, "60 s"),
  prefix: "plotfit:generate:ratelimit:v2",
  analytics: false,
  timeout: 5_000,
});

export async function checkRateLimit(ip: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}> {
  const result = await ratelimit.limit(ip);

  // SDK는 timeout이면 success: true를 반환한다. 유료 생성은 허용하지 않는다.
  // Redis 예외와 함께 호출부에서 503으로 처리한다.
  if (result.reason === "timeout") {
    throw new Error("Rate limit check timed out");
  }

  return {
    allowed: result.success,
    remaining: result.success ? Math.max(0, result.remaining) : 0,
    resetInSeconds: Math.max(1, Math.ceil((result.reset - Date.now()) / 1_000)),
  };
}
