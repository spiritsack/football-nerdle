import { Link } from "react-router-dom";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary hover:bg-primary-hover text-white",
  secondary: "bg-secondary hover:bg-secondary-hover text-white",
  ghost: "bg-surface-input hover:bg-gray-600 text-text-secondary",
  danger: "bg-red-600 hover:bg-red-500 text-white",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-4 py-1.5 text-sm",
  md: "px-6 py-3",
  lg: "px-6 py-4 text-xl",
};

interface BaseProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}

interface ButtonAsButton extends BaseProps, Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps> {
  to?: never;
}

interface ButtonAsLink extends BaseProps {
  to: string;
}

type ButtonProps = ButtonAsButton | ButtonAsLink;

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  to,
  children,
  ...rest
}: ButtonProps) {
  const classes = `${variantClasses[variant]} ${sizeClasses[size]} rounded-lg font-semibold transition-colors ${className}`;

  if (to) {
    return <Link to={to} className={classes}>{children}</Link>;
  }

  return <button className={classes} {...rest}>{children}</button>;
}
