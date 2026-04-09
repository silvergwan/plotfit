import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { baseProfile, plotContent } = await req.json();

  console.log("받은 baseProfile:", baseProfile);
  console.log("받은 plotContent:", plotContent);

  return NextResponse.json({ result: "테스트 응답입니다." });
}
