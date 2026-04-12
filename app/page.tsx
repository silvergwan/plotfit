"use client";
// next에서 이걸 쓰지 않으면 서버컴포넌트로 인식을 하여 브라우저 이벤트를 사용할 수가 없음

import { useState } from "react";
// useState는 사용자가 값을 입력하면 그 내용을 api로 전달하기 전에 가지고 있어야 보낼 수 있는데 그 저장소 역할을 함
import Header from "./components/Header";
import Button from "./components/Button";
import Textarea from "./components/Textarea";
import { Copy, Check } from "lucide-react";

export default function Home() {
  const [baseProfile, setBaseProfile] = useState("");
  // baseProfile은 상태이고, setBaseProfile은 상태 변경 함수임
  // 상태를 단순 변수로 이해하면 안됨, 상태는 React가 값의 변경을 알아채고 리렌더링까지 하는 아주 고차원적 개념
  const [plotContent, setPlotContent] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [isCopy, setIsCopy] = useState(false);

  // -----------------------------
  // POST/api/generate
  // -----------------------------
  const handleGenerate = async () => {
    setLoading(true);
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseProfile, plotContent }),
    });
    const data = await res.json();
    setResult(data.result);
    setLoading(false);
  };

  // 복사 함수
  const handleCopy = () => {
    if (isCopy) return;

    navigator.clipboard.writeText(result);
    setIsCopy(true);

    setTimeout(() => {
      setIsCopy(false);
    }, 2 * 1000);
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <Header />
      <div className="max-w-6xl mx-auto px-6 flex gap-12 pt-20">
        <div className="flex-1">
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight mb-6 text-white">
            플롯에 맞는
            <br />
            <span className="text-[#6728FF] font-bold">나만의 프로필</span>을
            <br />
            만들어드립니다.
          </h1>
          <p className="text-[#666] text-base max-w-lg leading-relaxed">
            플롯마다 매번 프로필을 수동으로 고치고 계신가요?
            <br />
            기본 대화 프로필과 플롯 내용을 넣으면, AI가 세계관(플롯)에 맞는 맞춤
            프로필을 만들어 드립니다.
          </p>

          {result && (
            <div className="mt-3 p-4 bg-[#1e1e1f] rounded-xl">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-[#888]">생성된 프로필</span>
                <button
                  onClick={handleCopy}
                  className="flex gap-1 items-center text-xs text-white p-2 rounded-2xl hover:bg-[#404043] cursor-pointer"
                >
                  {isCopy ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {result}
              </p>
            </div>
          )}
        </div>
        <div className="flex-1 bg-[#151516] p-6 rounded-2xl">
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
          <h3 className="px-2 pt-6 mb-2">플롯의 내용을 복붙해주세요</h3>
          <Textarea
            placeholder="플롯 내용을 붙여넣으세요"
            value={plotContent}
            onChange={(e) => setPlotContent(e.target.value)}
          />
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
