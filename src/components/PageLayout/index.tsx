interface Props {
  children: React.ReactNode;
  className?: string;
}

export default function PageLayout({ children, className = "" }: Props) {
  return (
    <div className={`min-h-screen bg-surface text-white flex flex-col ${className}`}>
      {children}
    </div>
  );
}
