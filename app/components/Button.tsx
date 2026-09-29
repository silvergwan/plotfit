import { LoaderCircle } from "lucide-react";
type ButtonProps = {
  onClick: () => void; // 함수
  label: string; // 문자열
  loading: boolean;
};

export default function Button({ onClick, label, loading }: ButtonProps) {
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        aria-busy={loading}
        className="w-full h-13 flex items-center justify-center gap-2 rounded-xl bg-[#6728FF] text-white font-medium text-[15px] p-3 disabled:opacity-70 disabled:cursor-wait"
      >
        {loading && <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />}
        {loading ? "프로필 생성 중…" : label}
      </button>
    </div>
  );
}
