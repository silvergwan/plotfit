/**
 * measure-before.ts
 * ─────────────────────────────────────────────────────
 * 리팩토링 전 (few-shot, 자연어 스트리밍) 출력 구조 안정성 측정
 *
 * 측정 기준:
 *   - 성공: #특이사항 AND #플롯 내 위치 두 섹션 모두 존재
 *   - 구조 실패: 둘 중 하나라도 누락
 *   - API 에러: OpenAI 호출 자체가 실패
 *
 * 왜 이 기준인가:
 *   현재 코드는 stream: true라 JSON 파싱 에러가 없다.
 *   하지만 구조가 깨지면 프론트에서 빈 섹션이 렌더링된다.
 *   → 이게 현재 방식의 실제 실패 지표다.
 */

import OpenAI from "openai";
import fs from "fs";
import { PLOT_PROFILE_SYSTEM_PROMPT } from "../lib/prompts";

const SYSTEM_PROMPT = PLOT_PROFILE_SYSTEM_PROMPT;

// 테스트케이스
const TEST_CASES = [
  {
    label: "대학생 세계관 (19세 고등학생 입력)",
    baseProfile:
      "나이: 19세\n성별: 남성\n성격: 소심하지만 남들에게는 다정다감\n직업: 고등학생",
    plotContent:
      "#대학생, 한국대 화학과, 20세 대학생 서이현, 서이현의 집, 과제",
  },
  {
    label: "회사/직장 세계관 (마케팅 직원)",
    baseProfile:
      "나이: 27세\n성별: 여성\n성격: 차분하고 꼼꼼함\n직업: 마케팅 회사 직원",
    plotContent:
      "같은 회사 팀장 강도윤과 야근 중. 강도윤은 무뚝뚝하지만 유저를 신경 쓰고 있다. 사내 부서 회의실, 거래처 보고서",
  },
  {
    label: "고등학교 세계관 (활발한 남성)",
    baseProfile: "나이: 18세\n성별: 남성\n성격: 활발하고 장난기가 많음",
    plotContent:
      "고등학교 방송부를 배경으로, 방송부장 한유라와 축제 준비를 하고 있다. 교실, 체육대회, 담임 선생님",
  },
  {
    label: "판타지 세계관 (외형 정보 포함)",
    baseProfile:
      "나이: 24세\n성별: 여성\n외형: 168cm, 붉은 머리, 날카로운 눈매\n성격: 독립적이고 고집이 셈",
    plotContent:
      "중세 판타지 왕국. 마법사 길드와 기사단이 공존하는 세계. 마법 도서관, 길드 소속, 마법 연구",
  },
  {
    label: "SF/사이버펑크 세계관",
    baseProfile:
      "나이: 31세\n성별: 남성\n성격: 냉정하고 분석적\n직업: 형사\n특이사항: 불면증",
    plotContent:
      "2089년 서울. AI와 인간의 경계가 무너진 사이버펑크 세계. 사이버 범죄 수사대 소속. 디지털 공간과 현실이 혼재.",
  },
  {
    label: "현대 로맨스 세계관 (외형 없음)",
    baseProfile:
      "나이: 22세\n성별: 여성\n성격: 밝고 수다스러움\n특이사항: 고양이 3마리 키움",
    plotContent:
      "현대 로맨스. 서울 홍대 근처 작은 독립 카페. 알바생과 단골 손님의 이야기.",
  },
  {
    label: "다중 캐릭터 플롯",
    baseProfile:
      "나이: 25세\n성별: 남성\n성격: 조용하고 관찰력이 뛰어남\n직업: 대학원생",
    plotContent:
      "판타지 왕국의 기사 훈련소. 수석 기사 류지한, 훈련 교관 박세준, 견습 기사들이 등장. 기사단 내부 계급 구조.",
  },
  {
    label: "외형 정보만 있는 케이스",
    baseProfile: "성별: 여성\n외형: 157cm, 검은 단발, 피부가 하얀 편",
    plotContent:
      "현대 의학 드라마. 대학병원 응급실. 레지던트와 인턴이 중심. 야간 당직, 수술실.",
  },
  {
    label: "특이사항이 많은 케이스",
    baseProfile:
      "나이: 20세\n성별: 남성\n성격: 겉으론 차갑지만 속은 따뜻함\n직업: 대학생\n특이사항: 전직 수영 선수, 오른손잡이, 단 것을 못 먹음, 개를 무서워함",
    plotContent: "#대학생 캠퍼스, 체육대학, 수영부, 동아리방, 전공 강의",
  },
  {
    label: "직업/신분 충돌 (직장인 → 고등학생)",
    baseProfile:
      "나이: 28세\n성별: 여성\n성격: 리더십이 강하고 책임감 있음\n직업: 직장인",
    plotContent:
      "고등학교 학생회를 배경으로 한 플롯. 학생회장 선거, 교실, 급식, 수학여행 준비.",
  },
];

// ── 구조 검증 함수 ────────────────────────────────────────────────────────────
// 현재 방식의 실패 기준: #특이사항, #플롯 내 위치 중 하나라도 없으면 구조 실패
function validateStructure(output: string): {
  valid: boolean;
  hasTraits: boolean;
  hasPlotPosition: boolean;
  hasAppearance: boolean; // 있으면 좋고, 없어도 됨 (입력에 없으면 생략이 정상)
} {
  const hasTraits = output.includes("#특이사항");
  const hasPlotPosition = output.includes("#플롯 내 위치");
  const hasAppearance = output.includes("#외형");

  return {
    valid: hasTraits && hasPlotPosition,
    hasTraits,
    hasPlotPosition,
    hasAppearance,
  };
}

// ── 측정 실행 ─────────────────────────────────────────────────────────────────
async function measureBefore() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("❌ OPENAI_API_KEY 환경변수가 없습니다.");
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  let structureSuccess = 0;
  let structureFail = 0;
  let apiError = 0;

  const details: Array<{
    label: string;
    status: "success" | "structure_fail" | "api_error";
    output?: string;
    validation?: ReturnType<typeof validateStructure>;
    error?: string;
  }> = [];

  console.log("\n [Before] 구조 안정성 측정 시작");
  console.log(`   방식: few-shot 자연어 스트리밍`);
  console.log(`   케이스: ${TEST_CASES.length}개`);
  console.log("=".repeat(60));

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    console.log(`\n[${i + 1}/${TEST_CASES.length}] ${tc.label}`);

    try {
      // 현재 PlotFit route.ts와 동일한 호출 방식
      // stream: true지만 측정을 위해 여기선 단건으로 받아도 결과는 동일
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        // response_format 없음 — 현재 방식 그대로
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `[기본 프로필]\n${tc.baseProfile}\n\n[플롯 내용]\n${tc.plotContent}`,
          },
        ],
      });

      const output = response.choices[0].message.content ?? "";
      const validation = validateStructure(output);

      console.log(
        `   출력 (앞 80자): ${output.substring(0, 80).replace(/\n/g, " ")}...`,
      );
      console.log(
        `   #외형: ${validation.hasAppearance ? "✅" : "—"}  #특이사항: ${validation.hasTraits ? "✅" : "❌"}  #플롯 내 위치: ${validation.hasPlotPosition ? "✅" : "❌"}`,
      );

      if (validation.valid) {
        structureSuccess++;
        details.push({
          label: tc.label,
          status: "success",
          output,
          validation,
        });
        console.log(`   결과: ✅ 구조 정상`);
      } else {
        structureFail++;
        details.push({
          label: tc.label,
          status: "structure_fail",
          output,
          validation,
        });
        console.log(`   결과: ❌ 구조 실패`);
        console.log(`   전체 출력:\n${output}`);
      }
    } catch (error) {
      apiError++;
      const msg = error instanceof Error ? error.message : String(error);
      details.push({ label: tc.label, status: "api_error", error: msg });
      console.log(`   결과: ⚠️  API 에러 - ${msg}`);
    }

    // Rate limit 방지
    if (i < TEST_CASES.length - 1) {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  // ── 결과 출력 ────────────────────────────────────────────────────────────────
  const total = TEST_CASES.length;
  const structureFailRate = (structureFail / total) * 100;

  console.log("\n" + "=".repeat(60));
  console.log("📊 측정 결과 (Before 리팩토링)");
  console.log("=".repeat(60));
  console.log(`총 케이스       : ${total}`);
  console.log(`✅ 구조 정상    : ${structureSuccess}`);
  console.log(`❌ 구조 실패    : ${structureFail}`);
  console.log(`⚠️  API 에러    : ${apiError}`);
  console.log(`\n📈 구조 실패율  : ${structureFailRate.toFixed(1)}%`);
  console.log("=".repeat(60));
  console.log("\n⚠️  이 수치를 기록해두세요. After 비교에 씁니다.\n");

  // ── JSON 저장 ─────────────────────────────────────────────────────────────────
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `result-before-${timestamp}.json`;

  const record = {
    timestamp: new Date().toISOString(),
    phase: "before_refactoring",
    method: "few-shot / 자연어 스트리밍 / response_format 없음",
    total,
    structureSuccess,
    structureFail,
    apiError,
    structureFailRate: Number(structureFailRate.toFixed(1)),
    details,
  };

  fs.writeFileSync(filename, JSON.stringify(record, null, 2), "utf-8");
  console.log(`💾 결과 저장: ${filename}`);
}

measureBefore().catch(console.error);
