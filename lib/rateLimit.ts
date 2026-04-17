// ip별 요청 시간을 저장하는 Map
// key값 : ip 주소
// value : 요청한 시간들의 배열
const requestMap = new Map<string, number[]>();

// 설정 값
const WINDOW_MS = 60 * 1000; // 1분
const MAX_REQUESTS = 5; // 1분에 최대 5회

export function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
} {
  const now = Date.now();

  // 해당 IP의 기존 요청 기록 가져오기 (없으면 빈 배열)
  const timestamps = requestMap.get(ip) ?? [];

  // 1분이 지난 오래된 요청은 걸러냄 (슬라이딩 윈도우 방식)
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);

  // 남은 요청 횟수 계산
  const remaining = Math.max(0, MAX_REQUESTS - recent.length);

  // 한도 초과 여부 확인
  if (recent.length >= MAX_REQUESTS) {
    // 가장 오래된 요청 기준으로 언제 리셋되는지 계산
    const oldest = Math.min(...recent);
    const resetInSeconds = Math.ceil((oldest + WINDOW_MS - now) / 1000);

    return { allowed: false, remaining: 0, resetInSeconds };
  }

  // 허용 — 현재 시간을 기록에 추가
  recent.push(now);
  requestMap.set(ip, recent);

  return { allowed: true, remaining: remaining - 1, resetInSeconds: 0 };
}
