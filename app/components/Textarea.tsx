type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export default function Textarea({ className = "h-48", ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      className={`w-full bg-[#1a1a1b] border border-white/8 hover:border-white/[0.14] focus:border-[#6728FF]/50 rounded-xl p-3 text-sm text-[#ddd] placeholder:text-[#777] resize-y outline-none transition-colors duration-150 leading-relaxed disabled:opacity-60 ${className}`}
    />
  );
}
