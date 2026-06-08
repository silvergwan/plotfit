"use client";

import { useState, useEffect, useRef } from "react";
import Header from "./components/Header";
import Button from "./components/Button";
import Textarea from "./components/Textarea";
import { Copy, Check } from "lucide-react";
import { initMixpanel, trackEvent } from "@/lib/mixpanel";
import type { ProfileOutput } from "@/lib/schema/profile-schema";

export default function Home() {
  const [baseProfile, setBaseProfile] = useState("");
  const [plotContent, setPlotContent] = useState("");

  // 변경: result가 string → ProfileOutput | null로 바뀜
  // 구조화된 데이터를 상태로 들고 있어야 각 필드를 따로 렌더링할 수 있음
  const [result, setResult] = useState<ProfileOutput | null>(null);

  const [loading, setLoading] = useState(false);
  const [isCopy, setIsCopy] = useState(false);
  const [error, setError] = useState("");

  const hasTrackedInput = useRef({ base: false, plot: false });
  // Mixpanel 초기화 + 페이지 진입 이벤트
  useEffect(() => {
    initMixpanel();
    trackEvent("page_viewed");
  }, []);

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
    if (!baseProfile.trim() || !plotContent.trim()) {
      setError("프로필과 플롯 내용을 모두 입력해주세요.");
      return;
    }

    setError("");
    setLoading(true);
    setResult(null);

    trackEvent("generate_clicked");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseProfile, plotContent }),
      });

      // 변경: 스트리밍 제거 → res.json() 한 번에 파싱
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "오류가 발생했습니다. 다시 시도해주세요.");
        trackEvent("generate_failed", {
          error_type: data.error ?? "unknown_server_error",
        });
        return;
      }

      // data.data가 ProfileOutput 타입
      setResult(data.data);
      trackEvent("generate_success");
    } catch {
      setError("네트워크 오류가 발생했습니다. 연결을 확인해주세요.");
      trackEvent("generate_failed", { error_type: "network_error" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (isCopy || !result) return;

    await navigator.clipboard.writeText(buildCopyText(result));
    setIsCopy(true);

    trackEvent("profile_copied");

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

          <div className="bg-[#111112] border border-white/8 rounded-2xl p-4 flex flex-col mt-8 max-h-150">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[12px] font-medium text-[#787878] tracking-widest">
                생성된 프로필
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
            {!loading && !result && (
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

            {/* Loading shimmer — 기존과 동일 */}
            {loading && (
              <div className="flex-1 flex flex-col gap-2.5 py-2">
                {[75, 90, 60, 85, 50, 80, 65].map((w, i) => (
                  <div
                    key={i}
                    className="h-3 rounded-md bg-[#1e1e1f] animate-pulse"
                    style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }}
                  />
                ))}
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

        {/* 입력 패널 — 기존과 동일 */}
        <div className="flex-1 bg-[#151516] p-6 rounded-2xl md:sticky md:top-20">
          <h3 className="px-2 mb-2">대화 프로필을 입력해주세요</h3>
          <Textarea
            placeholder="기본 프로필을 입력하세요.

예)
[나이: 25세]
[성별: 남성, ♂️]
[종족: 인간]

#외형
- 175cm, 65kg, 평범한 외형

#특이 사항
- 독서를 좋아함, 생각보단 다부진 몸
"
            value={baseProfile}
            onChange={(e) => {
              setBaseProfile(e.target.value);
              if (!hasTrackedInput.current.base && e.target.value.length > 0) {
                trackEvent("input_started", { field: "base_profile" });
                hasTrackedInput.current.base = true;
              }
            }}
          />
          <h3 className="px-2 pt-6 mb-2">플롯(캐릭터)의 내용을 복붙해주세요</h3>
          <Textarea
            placeholder="플롯 내용을 붙여넣으세요"
            value={plotContent}
            onChange={(e) => {
              setPlotContent(e.target.value);
              if (!hasTrackedInput.current.plot && e.target.value.length > 0) {
                trackEvent("input_started", { field: "plot_content" });
                hasTrackedInput.current.plot = true;
              }
            }}
          />
          {error && <p className="text-red-400 text-sm mt-2 px-2">{error}</p>}
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
