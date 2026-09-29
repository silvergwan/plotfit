// 실제 OpenAI 호출을 사용하는 소규모 회귀 평가: node scripts/check-background-adaptation.mjs
// 결과는 의미 품질 전반의 보장이 아닌 특정 실패 사례의 규칙 검사다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import OpenAI from "openai";
import nextEnv from "@next/env";
import { z } from "zod";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });

function loadSource(path, require = () => { throw new Error("Unexpected import"); }) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const sourceModule = { exports: {} };
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  vm.runInNewContext(outputText, { module: sourceModule, exports: sourceModule.exports, require });
  return sourceModule.exports;
}

const { buildStructuredProfilePrompt } = loadSource("../lib/structured-profile-prompt.ts");
const promptSource = readFileSync(new URL("../lib/structured-profile-prompt.ts", import.meta.url), "utf8");
const { ProfileOutputSchema } = loadSource("../lib/schema/profile-schema.ts", (id) => {
  if (id === "zod") return { z };
  throw new Error("Unexpected import");
});
const base = {
  appearance: { text: "185cm, 78kg. 짧은 검은 머리와 갈색 눈, 건장한 체격.", preserve: true },
  personality: { text: "마음이 여리고 배려심이 많으며 아기자기한 물건을 좋아함.", preserve: true },
  background: { text: "어린 시절 부모를 여의고 혼자 살아왔다. 현재 편의점에서 일하며 경찰 시험을 준비한다. 어려운 사람을 보호하는 경찰이 목표다.", preserve: true },
  other: { text: "작은 동물 모양 장식품을 모으고 높은 곳을 무서워한다.", preserve: true },
};
const plotContent = "마법과 검술이 공존하는 아르덴 왕국의 수도 루메인. 성문 경비대는 시민을 보호한다. 현대 편의점과 경찰 제도, 경찰 시험은 없다. 경비대 선발에는 체력 검사와 법률 구술시험이 있다. 사용자는 모집일에 접수소 앞에 도착한다. 사용자의 개인 배경은 미정이다.";
const cases = [
  { name: "preserve-all", profile: base },
  ...[1, 2, 3].map((n) => ({ name: `adapt-background-${n}`, profile: { ...base, background: { ...base.background, preserve: false } } })),
  { name: "appearance-only", profile: {
    appearance: base.appearance,
    personality: { text: "", preserve: true },
    background: { text: "", preserve: true },
    other: { text: "", preserve: true },
  } },
];

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is required. Set it in .env.local or the environment.");
    process.exitCode = 1;
    return;
  }
  const client = new OpenAI({ timeout: 30000, maxRetries: 0 });
  const results = [];
  for (const entry of cases) {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini", temperature: 0.7, response_format: { type: "json_object" },
      messages: [{ role: "system", content: buildStructuredProfilePrompt(entry.profile) }, { role: "user", content: JSON.stringify({ profile: entry.profile, plotContent }) }],
    });
    const output = ProfileOutputSchema.parse(JSON.parse(response.choices[0].message.content));
    const text = Object.values(output).join(" ");
    const checks = { appearancePreserved: /185/.test(output.appearance ?? "") && /78/.test(output.appearance ?? "") };
    if (entry.name === "preserve-all") {
      checks.originalWorkPreserved = /편의점/.test(text);
      checks.originalGoalPreserved = /경찰/.test(text);
    } else if (entry.name.startsWith("adapt-background")) {
      checks.noModernRemainders = !/편의점|경찰/.test(text);
      checks.livelihoodAdapted = /상점|가게|장터|시장|상인/.test(text);
      checks.goalAdapted = /경비대/.test(text);
      checks.pastPreserved = /부모/.test(text) && /여의|잃|돌아가|사별/.test(text);
    } else {
      checks.noInventedPersonalDetails = output.traits === "입력된 추가 설정 없음" && !/편의점|경찰|부모|장식품|배려/.test(text);
    }
    results.push({ name: entry.name, checks, passed: Object.values(checks).every(Boolean), output });
    console.log(JSON.stringify(results.at(-1)));
  }
  mkdirSync(new URL("../docs/evaluations/", import.meta.url), { recursive: true });
  writeFileSync(new URL("../docs/evaluations/background-adaptation.json", import.meta.url), JSON.stringify({
    timestamp: new Date().toISOString(), model: "gpt-4o-mini", temperature: 0.7,
    promptSourceHash: createHash("sha256").update(promptSource).digest("hex"),
    cases, plotContent, results,
  }, null, 2));
  if (results.some((entry) => !entry.passed)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Evaluation failed: ${error.name}${error.status ? ` (${error.status})` : ""}`);
  console.error(error.stack?.split("\n").filter((line) => line.trim().startsWith("at ")).join("\n"));
  process.exitCode = 1;
});
