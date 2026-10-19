import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { NAV_ITEMS } from "./constants";

function BallIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7.5l4 2.9-1.5 4.6h-5L8 10.4z" fill="currentColor" stroke="none" />
      <path d="M12 7.5V2.5M16 10.4l4.6-1.6M14.5 15l2.8 4M9.5 15l-2.8 4M8 10.4L3.4 8.8" />
    </svg>
  );
}

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/75 backdrop-blur-lg border-b border-slate-800 shadow-[0_8px_32px_rgba(0,0,0,0.37)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          <Link to="/" className="flex items-center gap-3 min-w-0" aria-label="Football Nerdle home">
            <span className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-tr from-pitch-600 to-pitch-500 flex items-center justify-center text-white shadow-lg shadow-pitch-500/30">
              <BallIcon />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-2xl leading-none tracking-wider font-bold whitespace-nowrap pt-1">
                <span className="bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">FOOTBALL</span>{" "}
                <span className="text-pitch-500">NERDLE</span>
              </span>
              <span className="block text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                Daily football trivia
              </span>
            </span>
          </Link>

          <nav aria-label="Main" className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end, daily, iconClass }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 border ${
                    isActive
                      ? "text-pitch-500 bg-pitch-500/10 border-pitch-500/20"
                      : "text-slate-300 border-transparent hover:text-white hover:bg-slate-800/60"
                  }`
                }
              >
                <Icon className={`w-4 h-4 ${iconClass ?? ""}`} aria-hidden="true" />
                <span>{label}</span>
                {daily && (
                  <span aria-hidden="true" className="bg-pitch-500 text-slate-950 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                    DAILY
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="md:hidden shrink-0 text-slate-300 hover:text-white p-2 rounded-lg glass-card"
          >
            {menuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id="mobile-menu" aria-label="Main" className="md:hidden border-t border-slate-800 px-4 pt-2 pb-4 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end, iconClass }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `w-full px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 ${
                  isActive ? "text-pitch-400 bg-pitch-500/10" : "text-slate-200 hover:bg-slate-800"
                }`
              }
            >
              <Icon className={`w-5 h-5 ${iconClass ?? "text-pitch-500"}`} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
