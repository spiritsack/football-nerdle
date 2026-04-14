type Variant = "error" | "warning" | "info";

const variantClasses: Record<Variant, string> = {
  error: "bg-orange-900/30 border-orange-700 text-orange-300",
  warning: "bg-amber-900/40 border-amber-600 text-amber-300",
  info: "bg-yellow-900/30 border-yellow-700 text-yellow-300",
};

interface Props {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

export default function Alert({ variant = "error", children, className = "" }: Props) {
  return (
    <div
      role="alert"
      className={`border rounded-lg px-4 py-3 text-center text-sm ${variantClasses[variant]} ${className}`}
    >
      {children}
    </div>
  );
}
