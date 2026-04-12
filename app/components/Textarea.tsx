type TextareaProps = {
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; // 이벤트 핸들러
};

export default function Textarea({
  placeholder,
  value,
  onChange,
}: TextareaProps) {
  return (
    <textarea
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className="w-full h-48 bg-[#1e1e1f] rounded-xl p-3 text-sm resize-none outline-none"
    />
  );
}
