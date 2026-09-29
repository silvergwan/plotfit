"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

export default function GenerationLoading() {
  const [takingLonger, setTakingLonger] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTakingLonger(true), 10000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="py-2">
      <div role="status" className="flex items-start gap-3 mb-6">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 mt-0.5 shrink-0 text-[#a78bfa] motion-safe:animate-spin" />
        <div>
          <p className="text-sm font-medium text-white">프로필을 만들고 있어요</p>
          <p className="mt-1 text-xs leading-relaxed text-[#aaa]">
            {takingLonger
              ? "생성이 아직 진행 중이에요. 완료되면 결과를 보여드릴게요."
              : "입력한 설정과 플롯을 바탕으로 생성 중이에요. 잠시만 기다려주세요."}
          </p>
        </div>
      </div>
      <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
        {["외형", "특이사항", "플롯 내 위치"].map((section) => (
          <div key={section} className="space-y-2.5">
            <div className="h-3 w-20 rounded bg-[#6728FF]/25" />
            <div className="h-3 w-full rounded bg-white/8" />
            <div className="h-3 w-4/5 rounded bg-white/8" />
          </div>
        ))}
      </div>
    </div>
  );
}
