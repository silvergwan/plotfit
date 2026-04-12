

type ButtonProps = {
  onClick: () => void; // 함수
  label: string; // 문자열
  loading: boolean;
};

export default function Button({ onClick, label, loading }: ButtonProps) {
  return (
    <div className="mt-4">
      <button
        onClick={onClick}
        disabled={loading}
        className="w-full h-13 rounded-xl bg-[#6728FF] text-white font-medium text-[15px] p-3 disabled:opacity-50"
      >
        {loading ? "생성 중..." : label}
      </button>
    </div>
  );
}
