/**
 * scripts/measure-100.ts
 *
 * 실제 제타 플롯 데이터 20개 × 유저 프로필 5개 = 100케이스 측정
 * 실행: OPENAI_API_KEY=sk-... npx tsx scripts/measure-100.ts
 */

import OpenAI from "openai";
import { ProfileOutputSchema } from "../lib/schema/profile-schema";
import { PLOT_PROFILE_SYSTEM_PROMPT as SYSTEM_PROMPT } from "../lib/prompts";
import fs from "fs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── 유저 프로필 5개 ────────────────────────────────────────────────────────────
const USER_PROFILES = [
  {
    id: "P1",
    label: "24세 남성 체육교육과 대학생",
    content: `나이: 24세
외형: 188cm, 82kg, 넓은 어깨와 다부진 체격
특이사항: 남성, 덩치에 걸맞지 않게 귀여운 캐릭터 굿즈를 수집하는 취미가 있음
성격: 겉모습은 차가워 보이지만 속정 깊고 눈물이 많은 편
직업: 대학생 (체육교육과)`,
  },
  {
    id: "P2",
    label: "28세 여성 인테리어 디자이너",
    content: `나이: 28세
외형: 162cm, 50kg, 단정한 단발머리에 세련된 스타일
특이사항: 여성, 자신보다 요리를 잘하거나 미식에 진심인 사람에게 호감을 느낌
성격: 매사에 당당하고 추진력이 좋으나, 내 사람에겐 한없이 부드러움
직업: 인테리어 디자이너`,
  },
  {
    id: "P3",
    label: "31세 남성 스타트업 마케터",
    content: `나이: 31세
외형: 175cm, 70kg, 햇볕에 그을린 피부와 탄탄한 체형
특이사항: 남성, 주말마다 아웃도어 스포츠(서핑, 캠핑)를 즐김
성격: 긍정적이고 유쾌하며, 처음 보는 사람과도 금방 친해지는 친화력의 소유자
직업: 스타트업 마케터`,
  },
  {
    id: "P4",
    label: "22세 여성 음대생",
    content: `나이: 22세
외형: 168cm, 48kg, 가늘고 긴 손가락과 차분한 분위기
특이사항: 여성, 비 오는 날 특유의 냄새와 감성을 좋아함
성격: 섬세하고 예민한 편이지만, 자신이 좋아하는 분야에는 엄청난 몰입도를 보임
직업: 음대생 (피아노 전공)`,
  },
  {
    id: "P5",
    label: "28세 여성 인테리어 디자이너 (동일 프로필 재사용)",
    content: `나이: 28세
외형: 162cm, 50kg, 단정한 단발머리에 세련된 스타일
특이사항: 여성, 자신보다 요리를 잘하거나 미식에 진심인 사람에게 호감을 느낌
성격: 매사에 당당하고 추진력이 좋으나, 내 사람에겐 한없이 부드러움
직업: 인테리어 디자이너`,
  },
];

// ── 플롯 20개 ──────────────────────────────────────────────────────────────────
const PLOTS = [
  {
    id: "F01",
    label: "송예린 (대학생/MT)",
    category: "남성향",
    content: `#대학생 #소꿉친구 #삼각관계 #hl #마조
송예린과 강민준은 3개월된 연인사이. 경영학과 1학년 대학생들의 MT 배경.
서한대 캠퍼스, MT 술자리. 송예린은 대기업 태산건설 회장의 막내딸. 경영학과 마스코트.
강민준은 같은 과 소꿉친구이자 남자친구. 최은관이 MT에서 등장.`,
  },
  {
    id: "F02",
    label: "세츠나 화이트 (판타지/마법 아카데미)",
    category: "남성향",
    content: `#판타지 #아카데미 #마법 #짝사랑 #유저바라기 #먼치킨
이그리스 마법 아카데미. 귀족 엘리트 클래스와 평민 마이너 클래스로 나뉨.
서열 결투 시스템 존재. 마이너 클래스 서열 1위: 최은관. 엘리트 클래스 서열 1위: 세츠나 화이트 (화이트 가문 영애, 빙결 마법 천재).
세츠나는 최은관에게 2년 전 첫눈에 반했지만 신분 차이로 경멸하는 척함.`,
  },
  {
    id: "F03",
    label: "류지희 (현대/조직 보스)",
    category: "남성향",
    content: `#순애 #보스 #조직 #집착 #언리밋
백사파: 대한민국 최대 조직. 보스 류지희 (25세 여성, 백발).
최은관: 백사파 행동대장, 전투력 1위.
류지희는 최은관 앞에서만 어리광을 부리며, 최은관이 위험한 임무에 나가는 것을 막음. 집무실 배경.`,
  },
  {
    id: "F04",
    label: "칼리아 (판타지/왕국)",
    category: "남성향",
    content: `#판타지 #로맨스 #순애 #유저바라기 #북부 #연애
힘으로 지배하는 북부 왕국 한드라의 여전사이자 여왕 칼리아 (23세).
최은관이 통치하는 왕국 아리엔. 칼리아가 영토 확장 중 최은관에게 첫눈에 반해 일부러 포로로 잡혀옴.
왕궁 감옥에서 심문 장면. 귀족, 기사, 왕국 배경.`,
  },
  {
    id: "F05",
    label: "서아린 (대학생/철벽녀 퀸카)",
    category: "남성향",
    content: `#대학생 #뺏기 #로맨스 #유저바라기 #짝사랑 #존예
서한대학교 캠퍼스. 신입생 환영회 술자리.
서아린 (20세): 서한대 퀸카, 최은관에게 첫눈에 반함.
이수역: 서아린의 소꿉친구, 서아린을 짝사랑.
2026년 3월 2일 저녁 서한대 근처 술집.`,
  },
  {
    id: "F06",
    label: "서이현 (대학생/여사친)",
    category: "남성향",
    content: `#여사친 #대학생 #엄친딸 #예쁨 #부자 #일상 #로맨스
서이현 (20세): 한국대 화학과 과석차 1등, 엄친딸. 최은관과 10년 넘은 소꿉친구.
서이현의 집 (고급 저택, 샹들리에, 대리석 바닥). 둘이 말없이 과제 중.
서이현 어머니가 한국대 교수, 아버지는 부유한 사업가.`,
  },
  {
    id: "F07",
    label: "일진녀 수현 (고등학교)",
    category: "남성향",
    content: `#일진녀 #일진 #학교 #까칠 #고등학생
고등학교 같은 반. 수현은 일진 여학생, 최은관을 경멸하고 괴롭힘.
체육시간 텅 빈 교실에서 단 둘이 남은 상황. 학교, 교실, 담임, 급식 배경.`,
  },
  {
    id: "F08",
    label: "이량 (판타지/역사)",
    category: "여성향",
    content: `#황제 #역키잡 #집착 #소유욕 #철벽 #판타지
화월국. 최은관은 황제 이량의 호위무사. 어릴 때부터 함께함.
이량이 최은관에게 고백했다 거절당한 후 차갑게 굶. 황궁, 황좌, 정무 배경.
운희 황후 존재. 귀족, 황제, 궁궐 세계관.`,
  },
  {
    id: "F09",
    label: "박지용 (현대/소꿉친구 연인)",
    category: "여성향",
    content: `#bl #hl #로맨스 #소꿉친구 #동갑 #츤데레 #커플 #당도100
박지용 (25세, 192cm, 한국대 패션디자인학과): 소꿉친구에서 연인이 된 지 3개월.
자취방 소파, TV 소리, 에어컨. 지용이 본능을 억누르며 유교보이 코스프레 중.
대학생 자취 세계관.`,
  },
  {
    id: "F10",
    label: "허태윤 (현대/군대)",
    category: "여성향",
    content: `#혐관 #전남친 #무뚝뚝 #군인 #대위 #재회 #질투
군대 부대. 허태윤 (29세, 192cm, 대위/중대장): 3년 전 헤어진 전남친.
새로운 부대 발령 첫날 회의실에서 재회. 군복, 계급장, 회의실 배경.
한채현: 태윤의 현재 여자친구 (플로리스트).`,
  },
  {
    id: "F11",
    label: "도해신 (현대/사채업자)",
    category: "여성향",
    content: `#혐관 #전남친 #사채업자 #조직보스 #재회
도해신 (29세, 215cm): 과거 연인, 현재 구천자금 사채업자 사장.
10년 만의 재회, 채권자와 채무자 관계. 낡은 단칸방, 강남 오피스텔.
현대 사회 배경.`,
  },
  {
    id: "F12",
    label: "최시우 (대학생/조폭 후배)",
    category: "여성향",
    content: `#장난 #조폭 #반전 #대학생 #캠퍼스 #조직 #보스
대학교 캠퍼스. 최시우 (20세, 건축공학과 1학년): 최은관의 후배, 실은 조폭 '흑야' 직계 후계자.
동아리방, 강의실, 캠퍼스 배경. 최은관이 시우를 놀리는 관계.`,
  },
  {
    id: "F13",
    label: "차우진 (현대/소꿉친구 동거)",
    category: "여성향",
    content: `#소꿉친구 #동거 #집착 #친구 #사투리 #hl #bl
차우진 (20대, 186cm): 어린이집부터 함께한 소꿉친구, 현재 동거 중.
아침 욕실/거실 배경, 칫솔 공유, 스킨십이 일상인 관계. 자취 동거 세계관.`,
  },
  {
    id: "F14",
    label: "권도현 (현대/스트리머)",
    category: "여성향",
    content: `#스트리머 #능글 #로맨스 #짝사랑 #순애 #언리밋
권도현 (26세, 185cm): 150만 팔로워 유명 스트리머. 합방 제안.
합방 후원창: 손 깍지 5분/뽀뽀 3회/키스 1회 등. 스트리머 방송 세계관.`,
  },
  {
    id: "M01",
    label: "강다은 & 정소이 (대학생/자취)",
    category: "다인캐",
    content: `#hl #순애 #로맨스 #하렘 #소꿉친구 #룸메이트 #동갑 #자취
강다은 (21세): 최은관의 소꿉친구, 짝사랑 중. 같은 대학교.
정소이 (20세): 강다은의 룸메이트, 최은관과 첫만남.
강다은의 자취 집 방문. 대학생 일상 자취 세계관.`,
  },
  {
    id: "M02",
    label: "용사파티 & 짐꾼 (판타지/무인도)",
    category: "다인캐",
    content: `#무인도 #용사파티 #짐꾼 #무시 #경멸 #판타지 #생존 #하렘
판타지 세계. 마왕 토벌 후 무인도에 소환됨.
최은관: 짐꾼 역할. 용사 카일과 파티원들(힐러 리아, 엘프 궁수 엘레나, 수인 도적 나비아, 마법사 세린)이 최은관을 무시.
생존 배경, 귀족/기사/마법 세계관.`,
  },
  {
    id: "M03",
    label: "정하온 & 박시은 & 최주하 (대학생/동안)",
    category: "다인캐",
    content: `#다인캐 #대학생 #일상 #하렘 #순애 #동갑 #동안
최은관: 20세 대학생, 동안이라 초등학생으로 오해받음.
정하온 (20세), 박시은 (20세), 최주하 (20세): 다른 대학교 1학년 3인방.
공원에서 최은관을 초등학생으로 오해하고 접근. 대학생 캠퍼스 일상 세계관.`,
  },
  {
    id: "W01",
    label: "에테르니아 RPG (판타지/이세계)",
    category: "세계관형",
    content: `#rpg #판타지 #이세계 #세계관 #모험 #왕국 #제국 #마법 #언리밋
에테르니아 대륙. 드라코니아 제국(드래곤), 루시리온 제국(천사), 아비스라 제국(악마), 실바네아 왕국(엘프), 발트라 왕국(드워프), 베스티아 왕국(수인), 아르덴 제국(인간/기사단), 카르디아(중립 상인도시).
귀족, 기사단, 마법사 길드, 모험가 길드 세계관.`,
  },
  {
    id: "W02",
    label: "아르케논 헌터 (현대판타지)",
    category: "세계관형",
    content: `#판타지 #현대판타지 #세계관 #헌터 #초능력 #능력 #하렘
현대 사회에 몬스터 출현, 헌터 각성. 등급: 흔적급~초월급(1위계).
최은관: 전 세계 1위 초월급 헌터, 은퇴 후 재소환.
측정 불가 게이트 발생. 한국 헌터 협회, 차유진 협회장, 일본/미국 초월급 헌터 등장.`,
  },
  {
    id: "W03",
    label: "마법학교 아카데미 (판타지/아카데미)",
    category: "세계관형",
    content: `#마법학교 #아카데미 #마법 #등급 #마물 #세계관 #마법사
마법이 존재하는 세계. 등급: F~EX (EX는 신의 영역, 전세계 4명).
최은관: EX등급, 남쪽 구역 담당. 마법학교 아카데미로 전학 소문.
학생: 민영(C/물), 희영(B/전기), 민혁(C/불), 하연(S/얼음). 선생님: 지영(SS/치유), 서현(SS/땅).`,
  },
];

// ── 품질 체크 함수 ─────────────────────────────────────────────────────────────
function checkQuality(
  output: { appearance: string | null; traits: string; plot_position: string },
  profile: (typeof USER_PROFILES)[0],
  plot: (typeof PLOTS)[0],
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  // 외형 정보 있으면 appearance가 있어야 함
  if (profile.content.includes("외형:") && output.appearance === null) {
    failures.push("외형 정보 있는데 appearance가 null");
  }

  // 성별 보존 확인
  const isMale = profile.content.includes("남성");
  const isFemale = profile.content.includes("여성");
  if (isMale && !output.traits.includes("남성")) {
    failures.push("traits에 성별(남성) 누락");
  }
  if (isFemale && !output.traits.includes("여성")) {
    failures.push("traits에 성별(여성) 누락");
  }

  // 세계관별 직업 조정 확인
  const plotText = plot.content;
  const isUniv = /대학생|캠퍼스|한국대|서한대|학과|과제|동아리/.test(plotText);
  const isHighSchool =
    /고등학생|고등학교|교실|담임|급식|수학여행|체육대회|학생회/.test(plotText);
  const isCompany = /회사|사내|팀장|부장|야근|부서|거래처/.test(plotText);
  const isFantasy =
    /귀족|집사|기사|마법|왕국|저택|가문|황제|황궁|마법사|길드|엘프|용사|아카데미/.test(
      plotText,
    );
  const isHunter = /헌터|게이트|초월급|마물/.test(plotText);

  if (isUniv) {
    if (!output.traits.includes("대학생")) {
      failures.push("대학생 세계관인데 traits에 '대학생' 없음");
    }
    // 19세 체크 (해당 프로필에는 없지만 혹시 모를 경우)
    if (profile.content.includes("19세") && output.traits.includes("19세")) {
      failures.push("대학생 세계관에서 19세가 20세로 조정되지 않음");
    }
  }

  if (isHighSchool && !output.traits.includes("고등학생")) {
    failures.push("고등학교 세계관인데 traits에 '고등학생' 없음");
  }

  // 호감 취향 보존 확인
  if (
    profile.content.includes("호감을 느낌") ||
    profile.content.includes("이상형")
  ) {
    const hasPreference =
      output.traits.includes("호감") ||
      output.traits.includes("이상형") ||
      output.traits.includes("요리") ||
      output.traits.includes("미식");
    if (!hasPreference) {
      failures.push("호감 취향이 traits에 보존되지 않음");
    }
  }

  // plot_position 구체성 확인
  if (output.plot_position.length < 20) {
    failures.push("plot_position이 너무 짧음 (20자 미만)");
  }

  return { passed: failures.length === 0, failures };
}

// ── 측정 실행 ─────────────────────────────────────────────────────────────────
async function measure100() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY 없음");
    process.exit(1);
  }

  // 100개 케이스 생성: 플롯 20개 × 프로필 5개
  const cases = PLOTS.flatMap((plot) =>
    USER_PROFILES.map((profile) => ({ plot, profile })),
  );

  let zodSuccess = 0,
    qualityPass = 0,
    zodFail = 0,
    jsonFail = 0,
    apiError = 0;
  const details: any[] = [];

  console.log(
    `\n📏 100케이스 측정 시작 (플롯 ${PLOTS.length}개 × 프로필 ${USER_PROFILES.length}개)`,
  );
  console.log("=".repeat(60));

  for (let i = 0; i < cases.length; i++) {
    const { plot, profile } = cases[i];
    const label = `[${i + 1}/100] ${plot.label} × ${profile.id}`;

    process.stdout.write(`${label} ... `);

    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `[기본 프로필]\n${profile.content}\n\n[플롯 내용]\n${plot.content}`,
          },
        ],
      });

      const raw = response.choices[0].message.content ?? "";
      let parsed: unknown;

      try {
        parsed = JSON.parse(raw);
      } catch {
        jsonFail++;
        details.push({
          label,
          status: "json_fail",
          plotId: plot.id,
          profileId: profile.id,
        });
        console.log("❌ JSON 실패");
        continue;
      }

      const validated = ProfileOutputSchema.safeParse(parsed);
      if (!validated.success) {
        zodFail++;
        const err = validated.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(", ");
        details.push({
          label,
          status: "zod_fail",
          error: err,
          plotId: plot.id,
          profileId: profile.id,
        });
        console.log(`❌ Zod 실패: ${err}`);
        continue;
      }

      zodSuccess++;
      const quality = checkQuality(validated.data, profile, plot);

      if (quality.passed) {
        qualityPass++;
        details.push({
          label,
          status: "quality_pass",
          output: validated.data,
          plotId: plot.id,
          profileId: profile.id,
          category: plot.category,
        });
        console.log("✅");
      } else {
        details.push({
          label,
          status: "quality_fail",
          output: validated.data,
          failures: quality.failures,
          plotId: plot.id,
          profileId: profile.id,
          category: plot.category,
        });
        console.log(`⚠️  품질: ${quality.failures.join(" | ")}`);
      }
    } catch (err) {
      apiError++;
      details.push({
        label,
        status: "api_error",
        error: String(err),
        plotId: plot.id,
        profileId: profile.id,
      });
      console.log(`⚠️  API 에러`);
    }

    // Rate limit 방지
    if (i < cases.length - 1) await new Promise((r) => setTimeout(r, 700));
  }

  // ── 결과 집계 ───────────────────────────────────────────────────────────────
  const total = cases.length;
  const structureFailRate = (((zodFail + jsonFail) / total) * 100).toFixed(1);
  const qualityFailRate = (((zodSuccess - qualityPass) / total) * 100).toFixed(
    1,
  );

  // 카테고리별 집계
  const byCategory: Record<string, { total: number; pass: number }> = {};
  for (const d of details) {
    const cat = (d as any).category ?? "unknown";
    if (!byCategory[cat]) byCategory[cat] = { total: 0, pass: 0 };
    byCategory[cat].total++;
    if ((d as any).status === "quality_pass") byCategory[cat].pass++;
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 100케이스 측정 결과");
  console.log("=".repeat(60));
  console.log(`총 케이스          : ${total}`);
  console.log(`✅ 구조+품질 통과  : ${qualityPass}`);
  console.log(`⚠️  구조 통과/품질 실패: ${zodSuccess - qualityPass}`);
  console.log(`❌ Zod 실패        : ${zodFail}`);
  console.log(`❌ JSON 실패       : ${jsonFail}`);
  console.log(`⚠️  API 에러       : ${apiError}`);
  console.log(`\n📈 구조 실패율     : ${structureFailRate}%`);
  console.log(`📈 품질 실패율     : ${qualityFailRate}%`);
  console.log(`\n카테고리별:`);
  for (const [cat, stat] of Object.entries(byCategory)) {
    console.log(
      `  ${cat}: ${stat.pass}/${stat.total} (${((stat.pass / stat.total) * 100).toFixed(0)}%)`,
    );
  }
  console.log("=".repeat(60));

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `result-100cases-${timestamp}.json`;
  fs.writeFileSync(
    filename,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        phase: "100_real_plot_cases",
        total,
        qualityPass,
        qualityFail: zodSuccess - qualityPass,
        zodFail,
        jsonFail,
        apiError,
        structureFailRate: Number(structureFailRate),
        qualityFailRate: Number(qualityFailRate),
        byCategory,
        details,
      },
      null,
      2,
    ),
    "utf-8",
  );

  console.log(`\n💾 저장: ${filename}`);
}

measure100().catch(console.error);
