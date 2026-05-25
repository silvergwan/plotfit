/**
 * scripts/measure-after.ts
 *
 * 리팩토링 후 구조 안정성 측정
 * Before와 동일한 10개 케이스 + 판타지 케이스 1개 추가
 *
 * 측정 기준:
 *   - 성공: Zod 검증 통과 (appearance: string|null, traits: string, plot_position: string)
 *   - Zod 실패: 구조는 JSON이지만 스키마 불일치
 *   - JSON 실패: JSON 자체 파싱 불가 (response_format: json_object 쓰면 거의 없음)
 *   - API 에러: OpenAI 호출 실패
 *
 * 실행:
 *   OPENAI_API_KEY=sk-... npx tsx scripts/measure-after.ts
 */

import OpenAI from "openai";
import { z } from "zod";
import fs from "fs";
import { PLOT_PROFILE_SYSTEM_PROMPT as SYSTEM_PROMPT } from "../lib/prompts";
import { ProfileOutputSchema } from "../lib/schema/profile-schema";

// ── Before와 동일한 10개 케이스 ───────────────────────────────────────────────
const TEST_CASES = [
  {
    label: "대학생 세계관 (19세 고등학생 입력)",
    baseProfile:
      "나이: 19세\n성별: 남성\n성격: 소심하지만 남들에게는 다정다감\n직업: 고등학생",
    plotContent:
      "#대학생, 한국대 화학과, 20세 대학생 서이현, 서이현의 집, 과제",
    checks: {
      traitsIncludes: ["20세", "대학생"],
      traitsExcludes: ["19세", "고등학생"],
    },
  },
  {
    label: "회사/직장 세계관 (마케팅 직원)",
    baseProfile:
      "나이: 27세\n성별: 여성\n성격: 차분하고 꼼꼼함\n직업: 마케팅 회사 직원",
    plotContent:
      "같은 회사 팀장 강도윤과 야근 중. 사내 부서 회의실, 거래처 보고서",
    checks: {
      traitsIncludes: ["회사"],
      traitsExcludes: [],
    },
  },
  {
    label: "고등학교 세계관 (활발한 남성)",
    baseProfile: "나이: 18세\n성별: 남성\n성격: 활발하고 장난기가 많음",
    plotContent:
      "고등학교 방송부를 배경으로, 방송부장 한유라와 축제 준비. 교실, 체육대회, 담임 선생님",
    checks: {
      traitsIncludes: ["고등학생"],
      traitsExcludes: [],
    },
  },
  {
    label: "판타지 세계관 (외형 정보 포함)",
    baseProfile:
      "나이: 24세\n성별: 여성\n외형: 168cm, 붉은 머리, 날카로운 눈매\n성격: 독립적이고 고집이 셈",
    plotContent:
      "중세 판타지 왕국. 마법사 길드와 기사단이 공존하는 세계. 마법 도서관, 길드 소속, 마법 연구",
    checks: {
      appearanceNotNull: true,
      traitsIncludes: [],
      traitsExcludes: [],
    },
  },
  {
    label: "SF/사이버펑크 세계관",
    baseProfile:
      "나이: 31세\n성별: 남성\n성격: 냉정하고 분석적\n직업: 형사\n특이사항: 불면증",
    plotContent:
      "2089년 서울. AI와 인간의 경계가 무너진 사이버펑크 세계. 사이버 범죄 수사대 소속.",
    checks: {
      traitsIncludes: [],
      traitsExcludes: [],
    },
  },
  {
    label: "현대 로맨스 세계관 (외형 없음)",
    baseProfile:
      "나이: 22세\n성별: 여성\n성격: 밝고 수다스러움\n특이사항: 고양이 3마리 키움",
    plotContent:
      "현대 로맨스. 서울 홍대 근처 작은 독립 카페. 알바생과 단골 손님의 이야기.",
    checks: {
      appearanceNull: true,
      traitsIncludes: [],
      traitsExcludes: [],
    },
  },
  {
    label: "다중 캐릭터 플롯",
    baseProfile:
      "나이: 25세\n성별: 남성\n성격: 조용하고 관찰력이 뛰어남\n직업: 대학원생",
    plotContent:
      "판타지 왕국의 기사 훈련소. 수석 기사 류지한, 훈련 교관 박세준, 견습 기사들. 기사단 내부 계급 구조.",
    checks: {
      traitsIncludes: [],
      traitsExcludes: [],
    },
  },
  {
    label: "외형 정보만 있는 케이스",
    baseProfile: "성별: 여성\n외형: 157cm, 검은 단발, 피부가 하얀 편",
    plotContent:
      "현대 의학 드라마. 대학병원 응급실. 레지던트와 인턴이 중심. 야간 당직, 수술실.",
    checks: {
      appearanceNotNull: true,
      traitsIncludes: [],
      traitsExcludes: [],
    },
  },
  {
    label: "특이사항이 많은 케이스",
    baseProfile:
      "나이: 20세\n성별: 남성\n성격: 겉으론 차갑지만 속은 따뜻함\n직업: 대학생\n특이사항: 전직 수영 선수, 오른손잡이, 단 것을 못 먹음, 개를 무서워함",
    plotContent: "#대학생 캠퍼스, 체육대학, 수영부, 동아리방, 전공 강의",
    checks: {
      traitsIncludes: ["대학생"],
      traitsExcludes: [],
    },
  },
  {
    label: "직업/신분 충돌 (직장인 → 고등학생)",
    baseProfile:
      "나이: 28세\n성별: 여성\n성격: 리더십이 강하고 책임감 있음\n직업: 직장인",
    plotContent:
      "고등학교 학생회를 배경으로 한 플롯. 학생회장 선거, 교실, 급식, 수학여행 준비.",
    checks: {
      traitsIncludes: ["고등학생"],
      traitsExcludes: ["직장인"],
    },
  },
  // Before에 없던 케이스 — 판타지 + 호감 취향
  {
    label: "판타지 세계관 + 호감 취향 보존 (신규)",
    baseProfile:
      "나이: 19세\n성별: 남성\n외형: 170cm, 55kg, 평범한 남성보다 왜소한 체형\n성격: 소심하지만 남들에게는 다정다감\n직업: 고등학생\n특이사항: 자신보다 키가 큰 이성(여성)에게 호감을 느낌",
    plotContent:
      "#소꿉친구 #주인 #집사 #약혼 #귀족\n금지된 사랑\n귀족 가문과 집사 관계가 중심인 판타지 세계관.",
    checks: {
      appearanceNotNull: true,
      traitsIncludes: ["집사", "여성"],
      traitsExcludes: ["고등학생"],
    },
  },
];

// ── 케이스별 품질 검증 ────────────────────────────────────────────────────────
function checkQuality(
  output: z.infer<typeof ProfileOutputSchema>,
  checks: (typeof TEST_CASES)[0]["checks"],
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  if (checks.appearanceNotNull && output.appearance === null) {
    failures.push("appearance가 null이어선 안 됨 (외형 정보 있음)");
  }
  if (checks.appearanceNull && output.appearance !== null) {
    failures.push("appearance가 null이어야 함 (외형 정보 없음)");
  }
  for (const word of checks.traitsIncludes ?? []) {
    if (!output.traits.includes(word)) {
      failures.push(`traits에 "${word}" 가 없음`);
    }
  }
  for (const word of checks.traitsExcludes ?? []) {
    if (output.traits.includes(word)) {
      failures.push(`traits에 "${word}" 가 있으면 안 됨`);
    }
  }

  return { passed: failures.length === 0, failures };
}

// ── 측정 실행 ─────────────────────────────────────────────────────────────────
async function measureAfter() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("❌ OPENAI_API_KEY 환경변수가 없습니다.");
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  let zodSuccess = 0;
  let qualitySuccess = 0;
  let zodFail = 0;
  let jsonFail = 0;
  let apiError = 0;

  const details: Array<{
    label: string;
    status:
      | "quality_pass"
      | "quality_fail"
      | "zod_fail"
      | "json_fail"
      | "api_error";
    output?: z.infer<typeof ProfileOutputSchema>;
    qualityFailures?: string[];
    error?: string;
  }> = [];

  console.log("\n📏 [After] 구조 안정성 측정 시작");
  console.log(`   방식: response_format:json_object + Zod 검증`);
  console.log(`   케이스: ${TEST_CASES.length}개 (Before 10개 + 신규 1개)`);
  console.log("=".repeat(60));

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    console.log(`\n[${i + 1}/${TEST_CASES.length}] ${tc.label}`);

    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `[기본 프로필]\n${tc.baseProfile}\n\n[플롯 내용]\n${tc.plotContent}`,
          },
        ],
      });

      const rawOutput = response.choices[0].message.content ?? "";

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawOutput);
      } catch {
        jsonFail++;
        details.push({
          label: tc.label,
          status: "json_fail",
          error: "JSON 파싱 실패",
        });
        console.log(`   결과: ❌ JSON 파싱 실패`);
        console.log(`   원본: ${rawOutput.substring(0, 100)}`);
        continue;
      }

      const validated = ProfileOutputSchema.safeParse(parsed);

      if (!validated.success) {
        zodFail++;
        const errorMsg = validated.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(", ");
        details.push({ label: tc.label, status: "zod_fail", error: errorMsg });
        console.log(`   결과: ❌ Zod 검증 실패 - ${errorMsg}`);
        continue;
      }

      zodSuccess++;
      const quality = checkQuality(validated.data, tc.checks);

      console.log(
        `   appearance: ${validated.data.appearance ? `"${validated.data.appearance.substring(0, 30)}..."` : "null"}`,
      );
      console.log(`   traits: "${validated.data.traits.substring(0, 50)}..."`);
      console.log(
        `   plot_position: "${validated.data.plot_position.substring(0, 50)}..."`,
      );

      if (quality.passed) {
        qualitySuccess++;
        details.push({
          label: tc.label,
          status: "quality_pass",
          output: validated.data,
        });
        console.log(`   결과: ✅ 구조 + 품질 통과`);
      } else {
        details.push({
          label: tc.label,
          status: "quality_fail",
          output: validated.data,
          qualityFailures: quality.failures,
        });
        console.log(`   결과: ⚠️  구조는 통과, 품질 실패`);
        quality.failures.forEach((f) => console.log(`     - ${f}`));
      }
    } catch (error) {
      apiError++;
      const msg = error instanceof Error ? error.message : String(error);
      details.push({ label: tc.label, status: "api_error", error: msg });
      console.log(`   결과: ⚠️  API 에러 - ${msg}`);
    }

    if (i < TEST_CASES.length - 1) {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  const total = TEST_CASES.length;
  const structureFailRate = ((zodFail + jsonFail) / total) * 100;
  const qualityFailRate =
    ((total - qualitySuccess - zodFail - jsonFail - apiError) / total) * 100;

  console.log("\n" + "=".repeat(60));
  console.log("📊 측정 결과 (After 리팩토링)");
  console.log("=".repeat(60));
  console.log(`총 케이스              : ${total}`);
  console.log(`✅ 구조 + 품질 통과    : ${qualitySuccess}`);
  console.log(`⚠️  구조 통과, 품질 실패: ${zodSuccess - qualitySuccess}`);
  console.log(`❌ Zod 검증 실패       : ${zodFail}`);
  console.log(`❌ JSON 파싱 실패      : ${jsonFail}`);
  console.log(`⚠️  API 에러           : ${apiError}`);
  console.log(`\n📈 구조 실패율         : ${structureFailRate.toFixed(1)}%`);
  console.log(`📈 품질 실패율         : ${qualityFailRate.toFixed(1)}%`);
  console.log("=".repeat(60));

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `result-after-${timestamp}.json`;

  fs.writeFileSync(
    filename,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        phase: "after_refactoring",
        method: "response_format:json_object + Zod 검증 + 재시도",
        total,
        qualitySuccess,
        qualityFail: zodSuccess - qualitySuccess,
        zodFail,
        jsonFail,
        apiError,
        structureFailRate: Number(structureFailRate.toFixed(1)),
        qualityFailRate: Number(qualityFailRate.toFixed(1)),
        details,
      },
      null,
      2,
    ),
    "utf-8",
  );

  console.log(`\n💾 결과 저장: ${filename}`);
  console.log("\n⚠️  Before 결과와 비교해서 포트폴리오에 기록하세요.");
}

measureAfter().catch(console.error);
