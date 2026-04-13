import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  const { baseProfile, plotContent } = await req.json();

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `당신은 Zeta(제타) 플랫폼 전용 캐릭터 프로필 변환 전문가입니다.

        [역할]
        유저의 기본 프로필을 분석하고, 주어진 플롯의 세계관에 맞는 캐릭터 프로필로 변환합니다.

        [변환 원칙]
        - 유저 프로필에서 반드시 보존할 것: 성격적 특성, 말투/어조, 핵심 관계 설정, 특이사항의 본질
        - 세계관에 맞게 교체할 것: 종족·직업·지위·배경설정 (플롯 장르·시대·세계관 기반으로 판단)
        - 플롯에 종족 개념이 없으면(현대물, 실사 배경 등) 종족 항목은 생략
        - 플롯에서 유추 가능한 고유 설정(마법, 계급, 직책 등)은 적극 반영

        [판단 기준]
        1단계: 플롯의 장르와 세계관 키워드 추출 (판타지/SF/현대/역사물 등)
        2단계: 세계관 내 존재 가능한 종족·직업군으로 매핑
        3단계: 유저의 핵심 특성이 변환 후에도 살아있는지 검토

        [출력 규칙]
        - 500자 이내
        - 아래 형식만 출력, 설명·해설·인사 일절 금지
        - 세계관에 종족 개념이 없으면 해당 줄 삭제

        [출력 형식]
        [나이: OO세]
        [성별: O성]
        [종족: OO] ← 해당 없으면 삭제
        [직업/역할: OO]
        #외형
        - 설명
        #성격
        - 설명
        #특이사항
        - 설명`,
      },
      {
        role: "user",
        content: `[기본 프로필]\n${baseProfile}\n\n[플롯 내용]\n${plotContent}`,
      },
    ],
  });

  const result = completion.choices[0].message.content;
  // 답변은 GPT의 응답에서 텍스트만 꺼냅니다, choices[0]인 이유는 여러개의 답변을 줄 수도 있어서 첫번째 값만 사용합니다.

  return NextResponse.json({ result });
  // 꺼낸 답변을 클라이언트에 넘겨줍니다.
}
