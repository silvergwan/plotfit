import { z } from "zod";

import { getProfileLength, PROFILE_MAX_LENGTH, PLOT_MAX_LENGTH } from "@/lib/profile";

const ProfileSectionSchema = z.object({
  text: z.string({ error: "프로필 항목은 문자열로 입력해주세요." }).trim(),
  preserve: z.boolean({ error: "설정 유지 여부를 선택해주세요." }),
});

export const GenerateInputSchema = z.object(
  {
    profile: z.object({
      appearance: ProfileSectionSchema,
      personality: ProfileSectionSchema,
      background: ProfileSectionSchema,
      other: ProfileSectionSchema,
    }, { error: "프로필 항목을 입력해주세요." }).superRefine((profile, ctx) => {
      const length = getProfileLength(profile);
      if (length === 0) {
        ctx.addIssue({ code: "custom", message: "프로필을 한 항목 이상 입력해주세요." });
      }
      if (length > PROFILE_MAX_LENGTH) {
        ctx.addIssue({ code: "custom", message: "프로필 네 항목은 합계 2,000자 이하로 입력해주세요." });
      }
    }),
    plotContent: z
      .string({
        error: (issue) => issue.input === undefined
          ? "플롯 내용이 누락되었습니다."
          : "플롯 내용은 문자열로 입력해주세요.",
      })
      .trim()
      .min(1, "플롯 내용을 입력해주세요.")
      .max(PLOT_MAX_LENGTH, "플롯 내용은 10,000자 이하로 입력해주세요."),
  },
  { error: "요청 본문은 JSON 객체여야 합니다." },
);
