# 생성 API 요청 제한

## 변경 전: Redis 카운터 직접 관리

여러 Vercel 인스턴스가 동일한 IP의 요청 횟수를 공유하도록 Upstash Redis를
사용했다. 다음은 SDK 전환 전 구현의 핵심이다.

```ts
const current = await redis.incr(`rate_limit:${ip}`);
if (current === 1) {
  await redis.expire(`rate_limit:${ip}`, 60);
}
const ttl = await redis.ttl(`rate_limit:${ip}`);
```

`INCR` 자체는 원자적이지만 증가와 만료 설정은 별도 요청이었다. 증가 후
만료 설정 전에 실행이 중단되면 만료 없는 카운터가 남을 가능성이 있었다.
이후에는 `current === 1`을 만족하지 않아 만료 설정을 재시도하지 않는다.
이는 코드 검토로 확인한 잠재적 실패 경로이며 운영 중 발생을 확인한 장애는 아니다.

## 변경 후: @upstash/ratelimit

- 기존 Redis 연결과 환경 변수는 유지한다.
- `Ratelimit.fixedWindow(5, "60 s")`로 IP당 각 1분 구간에 최대 5건의
  유효한 생성 요청을 허용한다. OpenAI 재시도 횟수나 사용 토큰 수를 세는 것은 아니다.
- SDK의 Redis Lua 스크립트가 카운터 증가와 만료 설정을 처리한다.
- 한도 초과는 기존과 동일하게 429 및 `Retry-After`를 반환한다.
- Redis 예외와 SDK의 `reason: "timeout"`은 503으로 처리하며 OpenAI를 호출하지 않는다.
  SDK의 기본 timeout 결과는 `success: true`이므로 별도 검사가 필요하다.
  확인 제한 시간은 5초로 명시했다.
- SDK 인스턴스를 모듈 범위에서 재사용한다. 기본 메모리 캐시는 이미 차단된
  식별자의 재요청을 거절하는 최적화이며, 공유 카운터는 Redis에 있다.
- Analytics는 비활성화한다. 단일 Redis를 사용하므로 별도의 분석·복제용
  백그라운드 작업을 추가하지 않는다.

## 시간 기준과 배포 시 주의점

기존 구현은 첫 요청으로부터 60초를 세었다. 새 구현은 매분 경계에서
초기화한다. 예를 들어 12:00:50에 처음 요청하면 12:01:00에 새 구간이 시작된다.
따라서 임의의 연속 60초 안에 반드시 5건 이하라고 보장하지는 않는다.
경계 직전과 직후에 각각 5건이 허용될 수 있다.

새 키 접두사는 `plotfit:generate:ratelimit:v2`이다. 기존 `rate_limit:*` 카운터와
충돌하지 않지만, 전환 시 기존 사용 횟수는 이관되지 않는다. 정상적인 기존 키는
원래 TTL에 따라 만료된다. 이미 TTL이 없어진 이전 키는 자동 정리되지 않지만
새 제한 계산에는 사용하지 않는다. 실제 Redis 키의 삭제·이관은 수행하지 않았다.

## 검증 범위

전환 시 로컬 검증 결과:

- `npm test`: 86개 통과.
- `npx tsc --noEmit`: 통과.
- `npx eslint lib/rateLimit.ts app/api/generate/route.ts tests/generate.test.mjs`: 통과.
- `npm run build`: 더미 API/Redis 환경 변수로 통과. 기존 edge runtime 정적 생성
  및 metadataBase 경고는 남아 있다.

`npm test`는 외부 Ratelimit/OpenAI SDK를 대체하고 실제 라우트와 요청 제한
어댑터를 실행한다. SDK의 허용·차단 결과를 받았을 때의 응답, 429 헤더,
Redis 예외·timeout 시 503 및 OpenAI 미호출, reset 시각의 초 단위 올림과
최소 1초 안내를 확인한다. SDK 내부 카운팅 알고리즘을 재구현하는 테스트는 아니다.

운영 Redis 및 OpenAI를 호출하는 통합 테스트, 다중 인스턴스 동시 요청,
실제 시간 경계에서의 초기화, Vercel 배포 검증은 별도로 필요하다.

## 참고

- [Upstash 알고리즘](https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms)
- [Upstash timeout 및 캐시](https://upstash.com/docs/redis/sdks/ratelimit-ts/features)
- [Upstash 반환값](https://upstash.com/docs/redis/sdks/ratelimit-ts/methods)
