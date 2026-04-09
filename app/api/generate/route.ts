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
        //// AI 행동 지침
        role: "system",
        content: `당신은 스캐터랩의 Zeta(제타) 서비스의 캐릭터·세계관(플롯) 분석가입니다.
    
    유저의 기본 프로필을 기반으로 플롯의 세계관에 맞게 변환해주는 역할입니다.

    변환 규칙:
    1. 유저의 핵심 특성(성격, 특이사항)은 최대한 유지
    2. 플롯 세계관에 맞게 종족, 직업, 배경만 변환
    3. 아래 형식 그대로 출력
    4. 500자 이내
    5. 프로필 내용만 출력, 설명 금지

    출력 형식:
    [나이: OO세]
    [성별: O성]
    [종족: OO]
    #외형
    - 설명
    #특이 사항
    - 설명`,
      },
      {
        // 실제 유저 입력 데이터
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
