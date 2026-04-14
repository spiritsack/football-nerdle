import { Link } from "react-router-dom";

interface HeaderLink {
  to: string;
  label: string;
  accent?: boolean;
}

interface Props {
  subtitle?: string;
  links?: HeaderLink[];
}

export default function PageHeader({ subtitle, links }: Props) {
  return (
    <header className="py-6 border-b border-border-subtle">
      <h1 className="text-3xl font-bold text-center">Football Nerdle</h1>
      {subtitle && (
        <p className="text-text-muted text-center mt-1">{subtitle}</p>
      )}
      {links && links.length > 0 && (
        <div className="flex items-center justify-center gap-4 mt-2">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-sm ${
                link.accent !== false
                  ? "text-success hover:text-green-300"
                  : "text-text-subtle hover:text-text-secondary"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
