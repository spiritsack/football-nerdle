import { Link } from "react-router-dom";
import { PANEL } from "../../theme";
import type { PageHeaderProps } from "./types";

const ACCENTS = {
  pitch: "bg-pitch-500/10 border-pitch-500/30 text-pitch-400",
  gold: "bg-gold-500/10 border-gold-500/30 text-gold-400",
};

/** Title bar at the top of a game screen, with a link back to Home. */
export default function PageHeader({ title, icon: Icon, accent = "pitch", children }: PageHeaderProps) {
  return (
    <header className={`${PANEL} p-4 flex flex-wrap items-center justify-between gap-4`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-10 h-10 shrink-0 rounded-lg border flex items-center justify-center ${ACCENTS[accent]}`}>
          <Icon className="w-5 h-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-bold text-white text-base">{title}</p>
          <Link to="/" className="text-pitch-400 hover:text-pitch-300 text-xs font-semibold">
            ← Back to Home
          </Link>
        </div>
      </div>
      {children}
    </header>
  );
}
