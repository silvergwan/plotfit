import { z } from "zod";

// 기존과 동일하게 앞뒤 공백을 제거한 문자열의 JS length를 검사한다.
export const GenerateInputSchema = z.object(
  {
    baseProfile: z
      .string({
        error: (issue) => issue.input === undefined
          ? "기본 프로필이 누락되었습니다."
          : "기본 프로필은 문자열로 입력해주세요.",
      })
      .trim()
      .min(1, "기본 프로필을 입력해주세요.")
      .max(2000, "기본 프로필은 2,000자 이하로 입력해주세요."),
    plotContent: z
      .string({
        error: (issue) => issue.input === undefined
          ? "플롯 내용이 누락되었습니다."
          : "플롯 내용은 문자열로 입력해주세요.",
      })
      .trim()
      .min(1, "플롯 내용을 입력해주세요.")
      .max(10000, "플롯 내용은 10,000자 이하로 입력해주세요."),
  },
  { error: "요청 본문은 JSON 객체여야 합니다." },
);
