interface Props {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className = "" }: Props) {
  return (
    <div className={`bg-surface-card border border-border-default rounded-xl p-6 ${className}`}>
      {children}
    </div>
  );
}
