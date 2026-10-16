import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url);
const emptyProfile = () => Object.fromEntries(
  ["appearance", "personality", "background", "other"].map((key) => [key, { text: "", preserve: true }]),
);
const validInput = {
  profile: { ...emptyProfile(), personality: { text: "기본 프로필", preserve: true } },
  plotContent: "플롯 내용",
};
const output = { appearance: null, traits: "성실함", plot_position: "동료" };

// 기존 TypeScript로 실제 서버 모듈을 메모리에서 변환한다.
// 외부 SDK는 모킹하고, NextResponse/Zod 및 요청 제한 어댑터는 그대로 실행한다.
// 허용하지 않은 import는 실패시켜 실수로 실제 외부 SDK를 로드하지 않는다.
function setup({ count = 1, failRedis = false, timeout = false, resetAfterMs = 42_000, failOpenAI = false, apiKey = "mock-only" } = {}) {
  const calls = { redis: [], openai: [] };
  const redis = {};
  const now = 1_800_000_000_000;
  let rateLimitOptions;
  class Ratelimit {
    static fixedWindow(limit, window) { return { limit, window }; }
    constructor(options) { rateLimitOptions = options; }
    async limit(identifier) {
      calls.redis.push(["limit", identifier]);
      if (failRedis) throw new Error("secret Redis URL/token");
      return {
        success: timeout || count <= 5,
        remaining: Math.max(0, 5 - count),
        limit: 5,
        reset: now + resetAfterMs,
        reason: timeout ? "timeout" : undefined,
        pending: Promise.resolve(),
      };
    }
  }
  class OpenAI {
    constructor({ apiKey }) {
      if (!apiKey) throw new Error("Missing credentials");
    }
    static APIError = class extends Error {};
    chat = {
      completions: {
        create: async (args) => {
          calls.openai.push(args);
          if (failOpenAI) throw new Error("secret OpenAI key");
          return {
            choices: [{ message: { content: JSON.stringify(output) } }],
          };
        },
      },
    };
  }
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const filename = fileURLToPath(new URL(path, root));
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: filename,
    });
    const loadedModule = { exports: {} };
    const sandboxRequire = (id) => {
      if (id === "openai") return OpenAI;
      if (id === "@upstash/redis") return { Redis: { fromEnv: () => redis } };
      if (id === "@upstash/ratelimit") return { Ratelimit };
      if (id === "zod" || id === "next/server") return require(id);
      if (id.startsWith("@/")) return load(`${id.slice(2)}.ts`);
      throw new Error(`Unmocked import: ${id}`);
    };
    vm.runInNewContext(
      outputText,
      {
        module: loadedModule,
        exports: loadedModule.exports,
        require: sandboxRequire,
        process: { env: { OPENAI_API_KEY: apiKey } },
        console: { error() {} },
        setTimeout,
        Date: class extends Date { static now() { return now; } },
      },
      { filename },
    );
    cache.set(path, loadedModule.exports);
    return loadedModule.exports;
  }
  const { POST } = load("app/api/generate/route.ts");
  const send = (body = JSON.stringify(validInput)) =>
    POST(
      new Request("http://localhost/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "192.0.2.1, 192.0.2.2",
        },
        body,
      }),
    );
  return { calls, send, rateLimitOptions, checkRateLimit: load("lib/rateLimit.ts").checkRateLimit };
}

for (const apiKey of [null, "", "   "]) {
  test(`키 미설정 시 모듈 로드 성공, 요청은 500: ${JSON.stringify(apiKey)}`, async () => {
    const { calls, send } = setup({ apiKey });
    const response = await send();
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: "서버 설정 오류입니다. 관리자에게 문의해주세요.",
    });
    assert.deepEqual(calls, { redis: [], openai: [] });
  });
}

test("정상 입력: trim, 응답 계약, SDK 요청 제한과 생성 설정 유지", async () => {
  const { calls, send, rateLimitOptions } = setup();
  const response = await send(
    JSON.stringify({
      profile: {
        ...emptyProfile(),
        personality: { text: "  기본 프로필 \n", preserve: true },
        background: { text: "  경찰을 꿈꿈  ", preserve: false },
      },
      plotContent: "\t플롯 내용  ",
    }),
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.data, output);
  assert.equal(body.success, true);
  assert.deepEqual(Object.keys(body._meta).sort(), [
    "attempts",
    "durationMs",
    "hadRetries",
    "validationErrorCount",
  ]);
  assert.equal(body._meta.attempts, 1);
  assert.equal(body._meta.hadRetries, false);
  assert.equal(body._meta.validationErrorCount, 0);
  assert.ok(body._meta.durationMs >= 0);
  assert.deepEqual(calls.redis, [["limit", "192.0.2.1"]]);
  assert.deepEqual(rateLimitOptions.limiter, { limit: 5, window: "60 s" });
  assert.equal(rateLimitOptions.timeout, 5_000);
  assert.equal(rateLimitOptions.analytics, false);
  assert.equal(calls.openai.length, 1);
  assert.equal(calls.openai[0].model, "gpt-4o-mini");
  assert.equal(calls.openai[0].temperature, 0.7);
  assert.equal(calls.openai[0].response_format.type, "json_object");
  assert.deepEqual(JSON.parse(calls.openai[0].messages[1].content), {
    profile: {
      ...emptyProfile(),
      personality: { text: "기본 프로필", preserve: true },
      background: { text: "경찰을 꿈꿈", preserve: false },
    },
    plotContent: "플롯 내용",
  });
});

const invalidBodies = [
  ["잘못된 JSON", "{"],
  ["빈 본문", ""],
  ...[null, [], "text", 123, true].map((value) => [
    `객체 아님: ${JSON.stringify(value)}`,
    JSON.stringify(value),
  ]),
  ["두 필드 누락", "{}"],
];
for (const field of ["profile", "plotContent"]) {
  const missing = { ...validInput };
  delete missing[field];
  invalidBodies.push([`${field} 누락`, JSON.stringify(missing)]);
  for (const value of [null, 123, false, [], {}, "", " \t\r\n "]) {
    invalidBodies.push([
      `${field}: ${JSON.stringify(value)}`,
      JSON.stringify({ ...validInput, [field]: value }),
    ]);
  }
}
invalidBodies.push(
  ["빈 프로필", JSON.stringify({ ...validInput, profile: emptyProfile() })],
  ["공백뿐인 프로필", JSON.stringify({ ...validInput, profile: { ...emptyProfile(), other: { text: " \t\n ", preserve: false } } })],
  ["플롯 길이 초과", JSON.stringify({ ...validInput, plotContent: "가".repeat(10001) })],
  ["프로필 합계 초과", JSON.stringify({ ...validInput, profile: {
    ...emptyProfile(),
    appearance: { text: "가".repeat(1000), preserve: true },
    background: { text: "나".repeat(1001), preserve: false },
  } })],
  ["기존 문자열 요청은 거절", JSON.stringify({ baseProfile: "기본 프로필", plotContent: "플롯 내용" })],
);
for (const key of Object.keys(emptyProfile())) {
  const missing = structuredClone(validInput);
  delete missing.profile[key];
  invalidBodies.push([`${key} 항목 누락`, JSON.stringify(missing)]);
  for (const section of [null, "text", [], {}, { text: 12, preserve: true }, { text: "설정" }, { text: "설정", preserve: "false" }, { text: "설정", preserve: null }]) {
    invalidBodies.push([`${key} 잘못된 항목 ${JSON.stringify(section)}`, JSON.stringify({
      ...validInput, profile: { ...validInput.profile, [key]: section },
    })]);
  }
}
for (const [name, body] of invalidBodies) {
  test(`400 및 Redis/OpenAI 호출 없음: ${name}`, async () => {
    const { calls, send } = setup();
    const response = await send(body);
    assert.equal(response.status, 400);
    const json = await response.json();
    assert.equal(typeof json.error, "string");
    assert.ok(json.error.length > 0);
    assert.deepEqual(calls, { redis: [], openai: [] });
  });
}

test("trim 후 정확히 2,000/10,000자 입력과 다섯 번째 요청 허용", async () => {
  const { calls, send } = setup({ count: 5 });
  const response = await send(
    JSON.stringify({
      profile: {
        ...emptyProfile(),
        appearance: { text: ` ${"가".repeat(1000)} `, preserve: true },
        background: { text: ` ${"나".repeat(1000)} `, preserve: false },
      },
      plotContent: ` ${"나".repeat(10000)} `,
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(calls.openai.length, 1);
});

for (const key of Object.keys(emptyProfile())) {
  for (const preserve of [true, false]) {
    test(`${key}만 작성해도 허용하고 유지 여부 ${preserve}를 모델에 전달`, async () => {
      const { calls, send } = setup();
      const input = { profile: { ...emptyProfile(), [key]: { text: "설정", preserve } }, plotContent: "플롯" };
      const response = await send(JSON.stringify(input));
      assert.equal(response.status, 200);
      assert.deepEqual(JSON.parse(calls.openai[0].messages[1].content), input);
    });
  }
}

test("여섯 번째 요청은 429, 기존 헤더 유지, OpenAI 호출 없음", async () => {
  const { calls, send } = setup({ count: 6 });
  const response = await send();
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "42");
  assert.equal(response.headers.get("X-RateLimit-Limit"), "5");
  assert.equal(response.headers.get("X-RateLimit-Remaining"), "0");
  assert.match((await response.json()).error, /42초/);
  assert.equal(calls.openai.length, 0);
});

for (const failure of [{ failRedis: true }, { timeout: true }]) {
  test(`제한 확인 실패 ${JSON.stringify(failure)}: 503, 내부 정보 비노출, OpenAI 호출 없음`, async () => {
    const { calls, send } = setup(failure);
    const response = await send();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "일시적인 서비스 장애입니다. 잠시 후 다시 시도해주세요.",
    });
    assert.equal(calls.openai.length, 0);
    assert.deepEqual(calls.redis, [["limit", "192.0.2.1"]]);
  });
}

for (const [resetAfterMs, seconds] of [[1_001, 2], [0, 1], [-1_000, 1]]) {
  test(`재시도 시간 ${resetAfterMs}ms는 ${seconds}초로 안내`, async () => {
    const { calls, send } = setup({ count: 6, resetAfterMs });
    const response = await send();
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), String(seconds));
    assert.equal(calls.openai.length, 0);
  });
}

test("SDK의 남은 횟수와 reset 시각을 기존 반환 형식으로 변환", async () => {
  const { checkRateLimit } = setup({ count: 2 });
  const result = await checkRateLimit("192.0.2.1");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 3);
  assert.equal(result.resetInSeconds, 42);
});

test("생성 예외도 내부 정보 없이 기존 500 JSON 반환", async () => {
  const { send } = setup({ failOpenAI: true });
  const response = await send();
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  });
});
