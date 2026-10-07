"use client";

import { useEffect, useRef, useState } from "react";
import Header from "./components/Header";
import Button from "./components/Button";
import Textarea from "./components/Textarea";
import GenerationLoading from "./components/GenerationLoading";
import { Copy, Check } from "lucide-react";
import { track } from "@vercel/analytics";
import type { ProfileOutput } from "@/lib/schema/profile-schema";
import { GenerateInputSchema } from "@/lib/schema/generate-input-schema";
import { createEmptyProfile, getProfileLength, PROFILE_FIELDS, PROFILE_MAX_LENGTH, PLOT_MAX_LENGTH, type ProfileField, type ProfileInput } from "@/lib/profile";

export default function Home() {
  const [profile, setProfile] = useState(createEmptyProfile);
  const [plotContent, setPlotContent] = useState("");
  const profileLength = getProfileLength(profile);
  const plotLength = plotContent.trim().length;

  const updateProfile = (key: ProfileField, update: Partial<ProfileInput[ProfileField]>) => {
    setProfile((current) => ({ ...current, [key]: { ...current[key], ...update } }));
  };

  // 변경: result가 string → ProfileOutput | null로 바뀜
  // 구조화된 데이터를 상태로 들고 있어야 각 필드를 따로 렌더링할 수 있음
  const [result, setResult] = useState<ProfileOutput | null>(null);

  const [loading, setLoading] = useState(false);
  const [isCopy, setIsCopy] = useState(false);
  const [error, setError] = useState("");
  const [generationError, setGenerationError] = useState("");
  const resultPanel = useRef<HTMLDivElement>(null);
  const requestInFlight = useRef(false);

  useEffect(() => {
    if (loading || result || generationError) {
      resultPanel.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
      resultPanel.current?.focus({ preventScroll: true });
    }
  }, [loading, result, generationError]);

  // 복사할 텍스트: JSON → 기존 #섹션 형식으로 조립
  // 유저 입장에서 붙여넣는 형식은 그대로 유지
  const buildCopyText = (data: ProfileOutput): string => {
    const lines: string[] = [];

    if (data.appearance) {
      lines.push("#외형");
      lines.push(data.appearance);
      lines.push("");
    }

    lines.push("#특이사항");
    lines.push(data.traits);
    lines.push("");
    lines.push("#플롯 내 위치");
    lines.push(data.plot_position);

    return lines.join("\n");
  };

  const handleGenerate = async () => {
    if (requestInFlight.current) return;
    const input = GenerateInputSchema.safeParse({ profile, plotContent });
    if (!input.success) {
      setError(input.error.issues[0].message);
      return;
    }

    setError("");
    setGenerationError("");
    requestInFlight.current = true;
    setLoading(true);
    setResult(null);
    setIsCopy(false);

    // 분석 전송 실패가 생성 동작을 막지 않게 한다.
    const trackGeneration = (event: string, properties?: Record<string, string>) => {
      try { track(event, properties); } catch { /* 생성 흐름을 계속 진행한다. */ }
    };
    trackGeneration("profile_generate_attempt");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.data),
      });

      // 변경: 스트리밍 제거 → res.json() 한 번에 파싱
      const data = await res.json();

      if (!res.ok) {
        setGenerationError(data.error ?? "오류가 발생했습니다. 다시 시도해주세요.");
        trackGeneration("profile_generate_fail", {
          error_type: data.error ?? "unknown_server_error",
        });
        return;
      }

      // data.data가 ProfileOutput 타입
      setResult(data.data);
      trackGeneration("profile_generate_success");
    } catch {
      setGenerationError("요청을 완료하지 못했습니다. 연결을 확인하고 다시 시도해주세요.");
      trackGeneration("profile_generate_fail", {
        error_type: "network_error",
      });
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (isCopy || !result) return;

    await navigator.clipboard.writeText(buildCopyText(result));
    setIsCopy(true);

    track("profile_copy");

    setTimeout(() => {
      setIsCopy(false);
    }, 2 * 1000);
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <Header />
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row gap-12 pt-20 md:items-start">
        <div className="flex-1">
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight mb-8 text-white">
            플롯에 맞는
            <br />
            <span className="text-[#6728FF] font-bold">나만의 프로필</span>을
            <br />
            만들어드립니다.
          </h1>
          <p className="text-[#959595] text-[16px] max-w-lg leading-relaxed">
            플롯마다 매번 프로필을 수동으로 고치고 계신가요?
            <br />
            기본 대화 프로필과 플롯 내용을 넣으면,
            <br />
            AI가 세계관(플롯)에 맞는 맞춤 프로필을 만들어 드립니다.
          </p>

          <div ref={resultPanel} tabIndex={-1} aria-label="프로필 생성 결과" className="bg-[#111112] border border-white/8 rounded-2xl p-4 flex flex-col mt-8 min-h-80 max-h-150 scroll-mt-6 focus-visible:outline-2 focus-visible:outline-[#a78bfa]">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[12px] font-medium text-[#787878] tracking-widest">
                {loading ? "프로필 생성 중" : "생성된 프로필"}
              </span>
              {result && (
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border transition-colors ${
                    isCopy
                      ? "text-[#7c4dff] border-[#7c4dff]/30 bg-[#7c4dff]/5"
                      : "text-[#888] border-white/8 bg-[#1a1a1b] hover:bg-[#222] hover:text-[#ccc]"
                  }`}
                >
                  {isCopy ? <Check size={13} /> : <Copy size={13} />}
                  {isCopy ? "복사됨" : "복사"}
                </button>
              )}
            </div>

            {/* Empty state */}
            {!loading && !result && !generationError && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12">
                <div className="w-12 h-12 rounded-xl border border-dashed border-white/9 flex items-center justify-center">
                  <span className="text-white/40 text-2xl">+</span>
                </div>
                <p className="text-[14px] text-[#676767] font-medium">
                  아직 생성된 프로필이 없습니다
                </p>
                <p className="text-[13px] text-[#555555] text-center leading-relaxed">
                  프로필과 플롯 내용을 입력하고
                  <br />
                  생성 버튼을 눌러주세요
                </p>
              </div>
            )}

            {loading && <GenerationLoading />}
            {!loading && generationError && (
              <div className="py-6">
                <p role="alert" className="text-sm text-red-300">{generationError}</p>
                <p className="mt-2 text-xs text-[#aaa]">입력한 내용은 그대로 남아 있어요.</p>
                <Button onClick={handleGenerate} label="다시 시도하기" loading={false} />
              </div>
            )}

            {/* 결과 렌더링: JSON 필드를 섹션별로 표시 */}
            {!loading && result && (
              <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
                {/* appearance는 null이면 섹션 자체를 렌더링하지 않음 */}
                {result.appearance && (
                  <div>
                    <p className="text-[11px] font-semibold text-[#6728FF] tracking-widest mb-1">
                      #외형
                    </p>
                    <p className="text-[13px] text-[#ccc] leading-relaxed">
                      {result.appearance}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-[11px] font-semibold text-[#6728FF] tracking-widest mb-1">
                    #특이사항
                  </p>
                  <p className="text-[13px] text-[#ccc] leading-relaxed">
                    {result.traits}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-[#6728FF] tracking-widest mb-1">
                    #플롯 내 위치
                  </p>
                  <p className="text-[13px] text-[#ccc] leading-relaxed">
                    {result.plot_position}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 bg-[#151516] p-6 rounded-2xl mb-12">
          <h2 className="text-lg font-semibold">대화 프로필</h2>
          <p id="profile-help" className="mt-2 text-sm text-[#aaa] leading-relaxed">
            원하는 항목만 입력해주세요. 한 항목 이상이면 충분해요.
          </p>
          <p id="preserve-help" className="mt-2 mb-5 text-xs text-[#aaa] leading-relaxed">
            ‘설정 유지’를 선택하면 의미와 수치를 보존하도록 요청하고, 표현만 다듬어요.
            해제하면 삭제하지 않고 세계관에 맞게 조정할 수 있어요.
          </p>
          <div className="space-y-4">
            {PROFILE_FIELDS.map(({ key, label, placeholder }) => (
              <div key={key}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label htmlFor={`profile-${key}`} className="text-sm font-medium">{label}</label>
                  <label className="flex items-center gap-2 py-1 text-xs text-[#bbb] cursor-pointer">
                    <input
                      type="checkbox"
                      aria-label={`${label} 설정 유지`}
                      aria-describedby="preserve-help"
                      checked={profile[key].preserve}
                      disabled={loading}
                      onChange={(e) => updateProfile(key, { preserve: e.target.checked })}
                      className="h-4 w-4 accent-[#6728FF]"
                    />
                    설정 유지
                  </label>
                </div>
                <Textarea
                  id={`profile-${key}`}
                  placeholder={placeholder}
                  value={profile[key].text}
                  disabled={loading}
                  onChange={(e) => updateProfile(key, { text: e.target.value })}
                  aria-describedby="profile-help profile-length"
                  aria-invalid={profileLength > PROFILE_MAX_LENGTH}
                  className="h-24 min-h-24"
                />
              </div>
            ))}
          </div>
          <p id="profile-length" className={`mt-2 text-right text-xs ${profileLength > PROFILE_MAX_LENGTH ? "text-red-400" : "text-[#999]"}`}>
            네 항목 합계 {profileLength.toLocaleString()} / {PROFILE_MAX_LENGTH.toLocaleString()}자
          </p>
          <label htmlFor="plot-content" className="block pt-6 mb-2 text-sm font-medium">플롯(캐릭터) 내용</label>
          <Textarea
            id="plot-content"
            placeholder="플롯 내용을 붙여넣으세요"
            value={plotContent}
            disabled={loading}
            aria-describedby="plot-length"
            aria-invalid={plotLength > PLOT_MAX_LENGTH}
            onChange={(e) => setPlotContent(e.target.value)}
          />
          <p id="plot-length" className={`mt-2 text-right text-xs ${plotLength > PLOT_MAX_LENGTH ? "text-red-400" : "text-[#999]"}`}>
            {plotLength.toLocaleString()} / {PLOT_MAX_LENGTH.toLocaleString()}자
          </p>
          {error && <p role="alert" className="text-red-400 text-sm mt-2">{error}</p>}
          <Button
            onClick={handleGenerate}
            label="프로필 생성하기"
            loading={loading}
          />
        </div>
      </div>
    </main>
  );
}
