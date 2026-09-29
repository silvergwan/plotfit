export const PROFILE_MAX_LENGTH = 2000;
export const PLOT_MAX_LENGTH = 10000;

export const PROFILE_FIELDS = [
  { key: "appearance", label: "외모", placeholder: "예: 185cm, 78kg, 건장한 체격과 남성적인 얼굴" },
  { key: "personality", label: "성격", placeholder: "예: 마음이 여리고 배려심이 많으며 아기자기한 것을 좋아함" },
  { key: "background", label: "배경", placeholder: "예: 부모를 일찍 여의고 혼자 살아감. 경찰이 되는 것이 꿈" },
  { key: "other", label: "기타", placeholder: "예: 이름, 나이, 성별, 취미, 취향 등 추가하고 싶은 설정" },
] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number]["key"];
export type ProfileInput = Record<ProfileField, { text: string; preserve: boolean }>;

export function createEmptyProfile(): ProfileInput {
  return {
    appearance: { text: "", preserve: true },
    personality: { text: "", preserve: true },
    background: { text: "", preserve: true },
    other: { text: "", preserve: true },
  };
}

export function getProfileLength(profile: ProfileInput): number {
  return PROFILE_FIELDS.reduce((length, { key }) => length + profile[key].text.trim().length, 0);
}
