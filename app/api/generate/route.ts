/**
 * app/api/generate/route.ts
 *
 * 리팩토링 내역:
 *   Before: stream:true → text/plain 스트리밍 → 프론트가 청크 조립
 *   After:  단건 JSON 응답 → Zod 검증 → 실패 시 최대 2회 재시도
 *
 * 왜 스트리밍을 제거했는가:
 *   - 현재 출력이 300자 제한이라 스트리밍 체감 효과가 없음
 *   - JSON을 스트리밍으로 받으면 파싱 타이밍이 복잡해짐
 *   - 구조 검증(Zod)은 완전한 JSON이 도착한 후에만 가능
 *
 * 왜 재시도 로직인가:
 *   - Zod 검증 실패는 API 에러가 아니라 구조 불일치
 *   - 같은 입력으로 재시도하면 대부분 해결됨 (temperature 0.7이라 매번 다름)
 *   - 재시도 횟수와 성공 여부를 응답에 포함 → 포트폴리오용 수치 수집 가능
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PLOT_PROFILE_SYSTEM_PROMPT } from "@/lib/prompts";
import {
  ProfileOutputSchema,
  type ProfileOutput,
} from "@/lib/schema/profile-schema";
import { checkRateLimit } from "@/lib/rateLimit";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ── 재시도 포함 생성 함수 ────────────────────────────────────────────────────
// maxRetries: 최초 1회 + 재시도 maxRetries회 = 총 maxRetries+1회 시도
async function generateProfile(
  baseProfile: string,
  plotContent: string,
  maxRetries: number = 2,
): Promise<{
  data: ProfileOutput;
  attempts: number; // 실제 시도 횟수 (1이면 첫 번째에 성공)
  validationErrors: string[]; // 재시도 중 발생한 Zod 에러 기록
}> {
  const validationErrors: string[] = [];

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      // response_format: json_object
      // 이 옵션 하나로 마크다운 코드블록 문제가 완전히 사라짐
      // 단, JSON 구조까지 강제하지는 않음 → Zod가 그 역할을 함
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PLOT_PROFILE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `[기본 프로필]\n${baseProfile}\n\n[플롯 내용]\n${plotContent}`,
        },
      ],
    });

    const rawOutput = response.choices[0].message.content ?? "";

    // JSON.parse: response_format: json_object 덕분에 SyntaxError는 거의 발생 안 함
    // 혹시 모를 경우를 위해 try-catch 안에 있음
    const parsed = JSON.parse(rawOutput);

    // safeParse: 실패해도 throw하지 않음
    // validate.success가 false면 validate.error.issues에 상세 에러 정보 있음
    const validated = ProfileOutputSchema.safeParse(parsed);

    if (validated.success) {
      return {
        data: validated.data,
        attempts: attempt,
        validationErrors,
      };
    }

    // Zod 검증 실패: 어떤 필드가 왜 실패했는지 기록
    const errorMsg = validated.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");

    validationErrors.push(`시도 ${attempt}: ${errorMsg}`);
    console.error(
      `[generate] Zod 검증 실패 (시도 ${attempt}/${maxRetries + 1}):`,
      errorMsg,
    );

    // 마지막 시도였으면 에러 throw
    if (attempt === maxRetries + 1) {
      throw new Error(`구조 검증 실패 (${maxRetries + 1}회 시도): ${errorMsg}`);
    }

    // 재시도 전 잠깐 대기 (exponential backoff 없이 단순 대기)
    await new Promise((r) => setTimeout(r, 500));
  }

  // TypeScript 타입 추론을 위한 안전장치 (실제로는 도달 불가)
  throw new Error("예상치 못한 오류");
}

// ── API Route 핸들러 ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Rate Limit 체크 (기존 로직 그대로 유지)
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

  // 입력 파싱 및 검증 (기존 로직 그대로 유지)
  let baseProfile: string;
  let plotContent: string;

  try {
    const body = await req.json();
    baseProfile = body.baseProfile?.trim();
    plotContent = body.plotContent?.trim();
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

  // 생성 실행
  try {
    const startTime = Date.now();
    const result = await generateProfile(baseProfile, plotContent);
    const durationMs = Date.now() - startTime;

    // 응답: data + _meta
    // _meta는 포트폴리오용 수치 수집에 쓰임 (Vercel Analytics 등으로 연결 가능)
    // 프론트에서 _meta를 무시하면 그냥 data만 써도 됨
    return NextResponse.json({
      success: true,
      data: result.data,
      _meta: {
        attempts: result.attempts,
        hadRetries: result.attempts > 1,
        validationErrorCount: result.validationErrors.length,
        durationMs,
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
