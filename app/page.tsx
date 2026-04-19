"use client";
// next에서 이걸 쓰지 않으면 서버컴포넌트로 인식을 하여 브라우저 이벤트를 사용할 수가 없음

import { useState } from "react";
// useState는 사용자가 값을 입력하면 그 내용을 api로 전달하기 전에 가지고 있어야 보낼 수 있는데 그 저장소 역할을 함
import Header from "./components/Header";
import Button from "./components/Button";
import Textarea from "./components/Textarea";
import { Copy, Check } from "lucide-react";
import { track } from "@vercel/analytics";

export default function Home() {
  const [baseProfile, setBaseProfile] = useState("");
  // baseProfile은 상태이고, setBaseProfile은 상태 변경 함수임
  // 상태를 단순 변수로 이해하면 안됨, 상태는 React가 값의 변경을 알아채고 리렌더링까지 하는 아주 고차원적 개념
  const [plotContent, setPlotContent] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [isCopy, setIsCopy] = useState(false);
  const [error, setError] = useState("");

  // -----------------------------
  // POST/api/generate
  // -----------------------------

  const handleGenerate = async () => {
    if (!baseProfile.trim() || !plotContent.trim()) {
      setError("프로필과 플롯 내용을 모두 입력해주세요.");
      return;
    }

    setError("");
    setLoading(true);
    setResult(""); // 이전 결과 초기화

    track("profile_generate_attempt");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseProfile, plotContent }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "오류가 발생했습니다. 다시 시도해주세요.");
        track("profile_generate_fail", {
          error_type: data.error ?? "unknown_server_error",
        });
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setError("스트림을 읽을 수 없습니다.");
        return;
      }

      setLoading(false);

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const text = decoder.decode(value, { stream: true });

        await sleep(60);
        setResult((prev) => prev + text);
      }

      track("profile_generate_success");
    } catch {
      setError("네트워크 오류가 발생했습니다. 연결을 확인해주세요.");
      track("profile_generate_fail", {
        error_type: "network_error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (isCopy) return;
    await navigator.clipboard.writeText(result); // await 추가
    setIsCopy(true);

    track("profile_copy");

    setTimeout(() => {
      setIsCopy(false);
    }, 2 * 1000);
  };

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

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

            {/* Loading shimmer */}
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

            {/* 결과 텍스트 */}
            {!loading && result && (
              <p className="flex-1 text-[13px] text-[#ccc] leading-relaxed whitespace-pre-wrap overflow-y-auto">
                {result}
              </p>
            )}
          </div>
        </div>
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
            onChange={(e) => setBaseProfile(e.target.value)}
          />
          <h3 className="px-2 pt-6 mb-2">플롯(캐릭터)의 내용을 복붙해주세요</h3>
          <Textarea
            placeholder="플롯 내용을 붙여넣으세요"
            value={plotContent}
            onChange={(e) => setPlotContent(e.target.value)}
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
