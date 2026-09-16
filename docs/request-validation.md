# 생성 요청 검증과 장애 처리

## 요청 흐름과 이번 변경

`app/page.tsx` → `/api/generate` → JSON 파싱 → Zod 입력 검증 →
IP별 Redis 요청 제한 → OpenAI 생성 → 기존 출력 검증/재시도 → JSON 응답.

기존에는 Redis 호출이 try/catch 밖에 있어 장애가 처리되지 않은 예외로
빠졌다. 이제 INCR/EXPIRE/TTL 중 어느 호출이 실패해도 고정된 503 JSON을
반환하며 OpenAI를 호출하지 않는다. 오류 원문은 응답에 넣지 않는다.

기존 입력 검증은 optional chaining과 trim 호출에 의존해 본문/필드 타입을
명시적으로 검증하지 않았다. 새 입력 스키마는 객체 여부, 필수 문자열,
공백뿐인 문자열, 길이를 검증한다. JSON 파싱 실패와 스키마 오류는 400이고,
응답에는 첫 번째 오류의 안내 문구를 `error` 문자열로 반환한다.
기존처럼 trim 후 JS 문자열 length 기준으로 2,000/10,000자를 허용한다.

입력 검증을 먼저 하면 잘못된 요청이 Redis 호출 비용과 사용자의 요청
할당량을 소비하지 않는다. 유효한 입력은 반드시 제한 검사를 통과해야
유료 OpenAI 호출이 가능하다. 대신 잘못된 요청도 본문 파싱 비용은 발생한다.
이는 HTTP 본문 크기/트래픽 제한을 대체하지 않는다.

성공 응답의 success/data/_meta, 실패 응답의 error, 429 헤더는 유지했다.
모델, 프롬프트, 출력 스키마, 생성 재시도 코드는 변경하지 않았다.

## 재현 가능한 검증

- `npm ci`: 기존 package-lock.json으로 설치. 새 의존성 없음.
- `npm test` (또는 `node --test tests/*.test.mjs`): 33개 테스트.
- `npx tsc --noEmit`: 통과.
- `npm run lint`: 기존 평가 스크립트의 오류 4개, 경고 3개로 실패.
  measure-100.ts의 no-explicit-any 3개와 미사용 변수 3개,
  measure-before-100.ts의 no-explicit-any 1개는 이번 변경 전에도 존재했다.
- `npm run build`: 더미 OPENAI_API_KEY, UPSTASH_REDIS_REST_URL
  (`https://redis.invalid`), UPSTASH_REDIS_REST_TOKEN으로 통과.
  기존 edge runtime 정적 생성 및 metadataBase 경고는 남아 있다.

테스트는 Node 내장 test runner와 기존 TypeScript transpileModule을 사용한다.
실제 라우트, 입력/출력 스키마, 요청 제한 코드를 메모리에서 실행하며
OpenAI SDK와 Redis SDK만 대체한다. 허용되지 않은 import는 실패한다.
NextResponse와 Zod는 실제 패키지를 사용한다. 테스트 파일의 VM 변환은
타입 검사를 수행하지 않으므로 별도로 tsc도 실행한다.

정상 입력/trim/길이 경계/응답 계약, 잘못된 JSON과 본문 타입, 필드 누락,
잘못된 필드 타입/공백/길이 초과, 다섯 번째 허용/여섯 번째 차단,
Redis 각 명령의 장애, 생성 예외의 정보 비노출을 확인한다.
잘못된 입력은 Redis와 OpenAI 모두 0회, 차단/Redis 장애는 OpenAI 0회를
검증한다. 실제 서비스 연결, 브라우저 E2E, 모델 품질 평가는 수행하지 않았다.

## 보존된 자료와 다음 기술 부채

result-*.json, scripts/의 기존 평가 코드, lib/prompts.ts는 수정하지 않았다.
현재 before 평가 스크립트들도 현재 프롬프트를 import한다. 과거 실행 당시
프롬프트/커밋/의존성 등 전체 조건은 미확인이므로 결과를 통제된 개선 전후
비교로 단정할 수 없다. 이후 평가에는 입력 데이터, 프롬프트/스키마 버전,
모델/파라미터, 재시도 정책과 코드 커밋을 고정해 기록할 필요가 있다.

후속 검토 항목:

- Redis INCR/EXPIRE가 분리되어 있어 EXPIRE 실패 시 TTL 없는 키가 남을 수
  있다. 이번에는 장애 요청을 차단했고, 원자적 카운터/만료 처리는 후속 과제다.
- 본문 바이트 제한과 프록시의 신뢰할 수 있는 IP 헤더/트래픽 제한을 확인한다.
- SDK 초기화 시 환경 설정 오류, 네트워크 타임아웃과 SDK 자체 재시도 정책은
  별도 운영 설정 점검이 필요하다. 이번 테스트는 Redis 명령 실행 장애 대상이다.
- 출력 JSON 파싱 실패와 OpenAI 호출 실패는 현재 생성 재시도 루프의
  Zod 검증 실패 재시도와 다르게 처리된다. 이번에는 기존 정책을 유지했다.
- 기존 평가 스크립트 린트 오류와 빌드 경고를 별도 정리한다.
