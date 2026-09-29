import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url);
const validInput = { baseProfile: "기본 프로필", plotContent: "플롯 내용" };
const output = { appearance: null, traits: "성실함", plot_position: "동료" };

// 기존 TypeScript로 실제 서버 모듈을 메모리에서 변환한다.
// 외부 SDK는 모킹하고, NextResponse/Zod 및 요청 제한 구현은 그대로 실행한다.
// 허용하지 않은 import는 실패시켜 실수로 실제 외부 SDK를 로드하지 않는다.
function setup({ count = 1, failRedis, failOpenAI = false } = {}) {
  const calls = { redis: [], openai: [] };
  const redis = Object.fromEntries(
    ["incr", "expire", "ttl"].map((method) => [
      method,
      async (...args) => {
        calls.redis.push([method, ...args]);
        if (failRedis === method) throw new Error("secret Redis URL/token");
        return method === "incr" ? count : method === "ttl" ? 42 : 1;
      },
    ]),
  );
  class OpenAI {
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
        process: { env: { OPENAI_API_KEY: "mock-only" } },
        console: { error() {} },
        setTimeout,
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
  return { calls, send };
}

test("정상 입력: trim, 응답 계약, 실제 요청 제한과 생성 설정 유지", async () => {
  const { calls, send } = setup();
  const response = await send(
    JSON.stringify({
      baseProfile: "  기본 프로필 \n",
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
  assert.deepEqual(calls.redis, [
    ["incr", "rate_limit:192.0.2.1"],
    ["expire", "rate_limit:192.0.2.1", 60],
    ["ttl", "rate_limit:192.0.2.1"],
  ]);
  assert.equal(calls.openai.length, 1);
  assert.equal(calls.openai[0].model, "gpt-4o-mini");
  assert.equal(calls.openai[0].temperature, 0.7);
  assert.equal(calls.openai[0].response_format.type, "json_object");
  assert.equal(
    calls.openai[0].messages[1].content,
    "[기본 프로필]\n기본 프로필\n\n[플롯 내용]\n플롯 내용",
  );
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
for (const field of ["baseProfile", "plotContent"]) {
  const missing = { ...validInput };
  delete missing[field];
  invalidBodies.push([`${field} 누락`, JSON.stringify(missing)]);
  for (const value of [null, 123, false, [], {}, "", " \t\r\n "]) {
    invalidBodies.push([
      `${field}: ${JSON.stringify(value)}`,
      JSON.stringify({ ...validInput, [field]: value }),
    ]);
  }
  invalidBodies.push([
    `${field} 길이 초과`,
    JSON.stringify({
      ...validInput,
      [field]: "가".repeat(field === "baseProfile" ? 2001 : 10001),
    }),
  ]);
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
      baseProfile: ` ${"가".repeat(2000)} `,
      plotContent: ` ${"나".repeat(10000)} `,
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(calls.openai.length, 1);
});

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

for (const failRedis of ["incr", "expire", "ttl"]) {
  test(`Redis ${failRedis} 장애: 503, 내부 정보 비노출, OpenAI 호출 없음`, async () => {
    const { calls, send } = setup({ failRedis });
    const response = await send();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "일시적인 서비스 장애입니다. 잠시 후 다시 시도해주세요.",
    });
    assert.equal(calls.openai.length, 0);
    assert.equal(calls.redis.at(-1)[0], failRedis);
  });
}

test("생성 예외도 내부 정보 없이 기존 500 JSON 반환", async () => {
  const { send } = setup({ failOpenAI: true });
  const response = await send();
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  });
});
