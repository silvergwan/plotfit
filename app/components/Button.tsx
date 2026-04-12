type ButtonProps = {
  onClick: () => void; // 함수
  label: string; // 문자열
};

export default function Button({ onClick, label }: ButtonProps) {
  return (
    <div className="px-4 mt-4">
      <button
        onClick={onClick}
        className="w-full h-13 rounded-xl bg-[#6728FF] text-white font-medium text-[15px] p-3"
      >
        {label}
      </button>
    </div>
  );
}
