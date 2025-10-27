interface DividerProps {
  className?: string;
}

export function Divider({ className }: DividerProps) {
  return (
    <div
      className={`h-px w-full bg-white/10 ${className ?? ''}`.trim()}
      aria-hidden
    />
  );
}

export default Divider;
