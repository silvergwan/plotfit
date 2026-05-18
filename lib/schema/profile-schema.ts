/**
 * lib/schemas/profile-schema.ts
 *
 * PlotFit 출력 구조를 런타임에서 강제하는 Zod 스키마.
 *
 * Before: 4,000자짜리 프롬프트가 LLM을 설득해서 구조를 맞춤
 * After:  이 스키마가 코드 레벨에서 구조를 보장
 *
 * 왜 Zod인가:
 *   - TypeScript 타입을 스키마에서 자동 추출 (interface 따로 안 써도 됨)
 *   - safeParse로 실패해도 throw 없이 에러 정보 확보 가능
 *   - z.coerce로 LLM이 "8" (문자열)로 내려보낸 숫자도 자동 변환
 */

import { z } from "zod";

export const ProfileOutputSchema = z.object({
  // 외형 정보 — 유저 프로필에 외형 입력이 없으면 null
  // z.string().nullable() : string 또는 null 허용
  // z.string().optional() 과 다름 — optional은 키 자체가 없어도 됨
  // nullable은 키는 있어야 하고 값이 null이어야 함 → 명시적 설계 의도
  appearance: z.string().nullable(),

  // 특이사항 — 필수, 항상 존재해야 함
  traits: z.string().min(1, "traits는 비어있을 수 없습니다"),

  // 플롯 내 위치 — 필수, 항상 존재해야 함
  plot_position: z.string().min(1, "plot_position은 비어있을 수 없습니다"),
});

// z.infer로 스키마에서 TypeScript 타입 자동 추출
// 이 타입을 route.ts, 프론트 컴포넌트에서 import해서 씀
export type ProfileOutput = z.infer<typeof ProfileOutputSchema>;

/**
 * ProfileOutput 타입 구조:
 * {
 *   appearance: string | null;
 *   traits: string;
 *   plot_position: string;
 * }
 */
