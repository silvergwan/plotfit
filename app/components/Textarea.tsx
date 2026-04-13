type TextareaProps = {
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
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
      className="w-full h-48 bg-[#1a1a1b] border border-white/8 hover:border-white/[0.14] focus:border-[#6728FF]/50 rounded-xl p-3 text-sm text-[#ddd] placeholder:text-[#3d3d3d] resize-none outline-none transition-colors duration-150 leading-relaxed"
    />
  );
}
