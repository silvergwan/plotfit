import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PLOT_PROFILE_SYSTEM_PROMPT } from "@/lib/prompts";
import { checkRateLimit } from "@/lib/rateLimit";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");

  const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";

  const { allowed, resetInSeconds } = await checkRateLimit(ip);

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
    baseProfile = body.baseProfile?.trim(); // trim 추가
    plotContent = body.plotContent?.trim(); // //
  } catch {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (!baseProfile || !plotContent) {
    return NextResponse.json(
      { error: "필수 입력값이 누락되었습니다." },
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
    const stream = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      stream: true,
      messages: [
        { role: "system", content: PLOT_PROFILE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `[기본 프로필]\n${baseProfile}\n\n[플롯 내용]\n${plotContent}`,
        },
      ],
    });

    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) {
            controller.enqueue(new TextEncoder().encode(text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
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
