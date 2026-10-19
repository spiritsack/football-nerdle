import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CircleHelp, Trophy, UserRound, Zap } from "lucide-react";
import { getTodayString } from "../../utils/dates";
import AppShell from "../../components/AppShell";
import HowToPlayModal from "../../components/HowToPlayModal";
import { BTN_MD, BTN_PRIMARY, BTN_SECONDARY } from "../../theme";
import { HOW_TO_PLAY } from "./constants";
import { readHomeDailyState } from "./helpers";
import type { GameModeKey } from "./types";

const HOW_TO_PLAY_BUTTON_CLASS =
  "mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white transition-colors";

export default function Home() {
  const [{ dailyDone, summary }] = useState(() => readHomeDailyState(getTodayString()));
  const [openRules, setOpenRules] = useState<GameModeKey | null>(null);

  return (
    <AppShell>
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 md:space-y-8">
        <header className="relative overflow-hidden rounded-3xl glass-panel border-pitch-500/20 shadow-stadium p-6 sm:p-8 md:p-12">
          <div className="absolute -right-10 -bottom-12 opacity-10 pointer-events-none" aria-hidden="true">
            <Trophy className="w-56 h-56 md:w-72 md:h-72 text-pitch-500" strokeWidth={1.5} />
          </div>
          <div className="relative max-w-2xl space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pitch-500/10 border border-pitch-500/30 text-pitch-400 text-xs font-semibold uppercase tracking-wide">
              <span className="relative flex w-2 h-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full rounded-full bg-pitch-500 opacity-75 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-pitch-500" />
              </span>
              Today's daily puzzle is live
            </span>
            <h1 className="font-display font-bold uppercase tracking-wide leading-[0.85] text-6xl sm:text-7xl md:text-8xl">
              Football <span className="text-pitch-500">Nerdle</span>
            </h1>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Guess the mystery footballer from their club history, or build a chain of players who played together.
            </p>
          </div>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          <section className="glass-panel rounded-2xl border-slate-800 hover:border-pitch-500/40 transition-colors p-6 flex flex-col group">
            <div className="flex justify-between items-start mb-4">
              <span className="w-12 h-12 rounded-xl bg-pitch-500/10 border border-pitch-500/30 flex items-center justify-center text-pitch-400 group-hover:scale-110 transition-transform">
                <UserRound className="w-6 h-6" aria-hidden="true" />
              </span>
              <span className="text-xs uppercase font-bold text-pitch-400 tracking-wider px-2.5 py-1 rounded-full bg-pitch-500/10 border border-pitch-500/20">
                Daily
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Guess the Player</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              See a player's club history and guess who it is. 5 attempts to get it right.
            </p>
            <div className="mt-auto pt-5">
              <div className="pt-4 border-t border-slate-800 flex flex-wrap gap-3">
                <Link
                  to="/guess"
                  className={`${dailyDone ? BTN_SECONDARY : BTN_PRIMARY} ${BTN_MD} flex-1 min-w-40`}
                >
                  {dailyDone ? "Daily (Done)" : "Daily Challenge"}
                </Link>
                <Link
                  to="/guess/archive"
                  className={`${dailyDone ? BTN_PRIMARY : BTN_SECONDARY} ${BTN_MD} flex-1 min-w-40`}
                >
                  Archive
                </Link>
              </div>
              {summary && (
                <p data-testid="daily-summary" className="mt-3 text-sm text-slate-300">
                  <span className={summary.won ? "font-semibold text-pitch-400" : undefined}>
                    {summary.headline}
                  </span>
                  {summary.streak !== null && (
                    <>
                      {" · "}
                      <span aria-hidden="true">🔥</span> {summary.streak}-day streak
                    </>
                  )}
                </p>
              )}
              <button
                type="button"
                onClick={() => setOpenRules("guess")}
                className={HOW_TO_PLAY_BUTTON_CLASS}
              >
                <CircleHelp className="w-4 h-4 text-pitch-500" aria-hidden="true" />
                How to play
              </button>
            </div>
          </section>

          <section className="glass-panel rounded-2xl border-slate-800 hover:border-gold-500/40 transition-colors p-6 flex flex-col group">
            <Link to="/battle" className="block flex-1">
              <div className="flex justify-between items-start mb-4">
                <span className="w-12 h-12 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400 group-hover:scale-110 transition-transform">
                  <Zap className="w-6 h-6" aria-hidden="true" />
                </span>
                <span className="text-xs uppercase font-bold text-gold-400 tracking-wider px-2.5 py-1 rounded-full bg-gold-500/10 border border-gold-500/20">
                  Solo &amp; PvP
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Battle Mode</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Name footballers who played together to build the longest chain. 15 seconds per turn.
              </p>
              <span className="mt-5 pt-4 border-t border-slate-800 flex">
                <span className="w-full py-2.5 rounded-xl bg-slate-800 group-hover:bg-gold-500 group-hover:text-slate-950 font-bold text-sm text-slate-200 transition-all flex items-center justify-center gap-2">
                  Start a chain
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </span>
              </span>
            </Link>
            <div>
              <button
                type="button"
                onClick={() => setOpenRules("battle")}
                className={HOW_TO_PLAY_BUTTON_CLASS}
              >
                <CircleHelp className="w-4 h-4 text-gold-500" aria-hidden="true" />
                How to play
              </button>
            </div>
          </section>
        </div>
      </main>

      {openRules && (
        <HowToPlayModal
          title={HOW_TO_PLAY[openRules].title}
          rules={HOW_TO_PLAY[openRules].rules}
          onClose={() => setOpenRules(null)}
        />
      )}
    </AppShell>
  );
}
