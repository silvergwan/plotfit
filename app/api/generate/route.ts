import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PLOT_PROFILE_SYSTEM_PROMPT } from "@/lib/prompts";
import { checkRateLimit } from "@/lib/rateLimit"; // 레잇리밋

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  // Rate Lmit 체크
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0].trim() ?? "unknown";

  const { allowed, resetInSeconds } = checkRateLimit(ip);

  if (!allowed) {
    return NextResponse.json(
      {
        error: `요청이 너무 많습니다. ${resetInSeconds}초 후에 다시 시도해주세요.`,
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": "5",
          "X-RateLimit-Remaining": "0",
          "Retry-After": String(resetInSeconds),
        },
      },
    );
  }

  let baseProfile: string;
  let plotContent: string;

  try {
    const body = await req.json();
    baseProfile = body.baseProfile;
    plotContent = body.plotContent;
  } catch {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (baseProfile.length > 2000 || plotContent.length > 10000) {
    return NextResponse.json(
      { error: "입력값이 너무 깁니다." },
      { status: 400 },
    );
  }

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: PLOT_PROFILE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `[기본 프로필]\n${baseProfile}\n\n[플롯 내용]\n${plotContent}`,
        },
      ],
    });

    const result = completion.choices[0]?.message?.content;

    if (!result) {
      return NextResponse.json(
        { error: "AI가 응답을 생성하지 못했습니다. 다시 시도해주세요." },
        { status: 500 },
      );
    }

    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error("OpenAI API Error:", error.status, error.message);

      if (error.status === 401) {
        return NextResponse.json(
          { error: "서버 설정 오류입니다. 관리자에게 문의해주세요." },
          { status: 500 },
        );
      }
      if (error.status === 429) {
        return NextResponse.json(
          { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
          { status: 429 },
        );
      }

      return NextResponse.json(
        { error: "AI 서비스 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
        { status: error.status ?? 500 },
      );
    }

    console.error("Unexpected Error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
