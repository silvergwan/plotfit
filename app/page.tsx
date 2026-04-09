"use client";
// next에서 이걸 쓰지 않으면 서버컴포넌트로 인식을 하여 브라우저 이벤트를 사용할 수가 없음

import { useState } from "react";
// useState는 사용자가 값을 입력하면 그 내용을 api로 전달하기 전에 가지고 있어야 보낼 수 있는데 그 저장소 역할을 함

export default function Home() {
  const [baseProfile, setBaseProfile] = useState("");
  // baseProfile은 상태이고, setBaseProfile은 상태 변경 함수임
  // 상태를 단순 변수로 이해하면 안됨, 상태는 React가 값의 변경을 알아채고 리렌더링까지 하는 아주 고차원적 개념
  const [plotContent, setPlotContent] = useState("");

  const [result, setResult] = useState("");

  // -----------------------------
  // POST/api/generate
  // -----------------------------
  const handleGenerate = async () => {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseProfile, plotContent }),
    });
    const data = await res.json();
    console.log("data 전체:", data);
    console.log("data.result:", data.result);
    setResult(data.result);
    console.log("result 상태:", result);
  };
  // -----------------------------

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1>PlotFit</h1>
        <p>플롯에 맞는 나만의 프로필을 만들어드립니다.</p>

        <textarea
          placeholder="기본 프로필을 입력하세요"
          value={baseProfile}
          onChange={(e) => setBaseProfile(e.target.value)}
          // 키를 하나 누를 때마다 onChange가 실행되고 e.target.value로 그 시점의 데이터를 setBaseProfile(useState) 저장소에 넣음
          // 그리고 setBaseProfile가 실행되면 React가 자동으로 화면을 다시 그림 -> React의 핵심! = 값이 바뀌면 알아서 렌더링
        />
        <textarea
          placeholder="플롯 내용을 붙여넣으세요"
          value={plotContent}
          onChange={(e) => setPlotContent(e.target.value)}
        />

        <button onClick={handleGenerate}>프로필 생성하기</button>

        <p>{result}</p>
      </div>
    </main>
  );
}
