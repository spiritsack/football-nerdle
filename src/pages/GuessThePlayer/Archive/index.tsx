import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, X, type LucideIcon } from "lucide-react";
import { getAllScheduledDays } from "../../../api/dailySchedule";
import { getDayNumber, getDailyResultForDate } from "../helpers";
import { SEED_PLAYERS } from "../../../data/seedPlayers";
import AppShell from "../../../components/AppShell";
import { BACK_LINK, PANEL } from "../../../theme";

// Keyed by the stored result ("won" / "lost" / "null" for not played)
const RESULT_STYLES: Record<string, { label: string; tile: string; swatch: string; icon: LucideIcon | null }> = {
  won: {
    label: "Solved",
    tile: "bg-pitch-500/10 border-pitch-500/40 text-pitch-400 hover:border-pitch-500",
    swatch: "bg-pitch-500/20 border-pitch-500",
    icon: Check,
  },
  lost: {
    label: "Failed",
    tile: "bg-rose-500/10 border-rose-500/40 text-rose-400 hover:border-rose-500",
    swatch: "bg-rose-500/20 border-rose-500",
    icon: X,
  },
  null: {
    label: "Not played",
    tile: "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-pitch-500/50",
    swatch: "bg-slate-800 border-slate-700",
    icon: null,
  },
};

export default function GuessArchive() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<{ date: string; dayNum: number; name: string; result: "won" | "lost" | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const rows = await getAllScheduledDays();
      const today = new Date().toISOString().split("T")[0];
      const result = rows
        .filter((r) => r.date < today) // only past days
        .map((r) => {
          const player = SEED_PLAYERS.find((p) => p.id === r.player_id);
          const stored = getDailyResultForDate(r.date);
          return {
            date: r.date,
            dayNum: getDayNumber(r.date),
            name: player?.name ?? "Unknown",
            result: stored?.status ?? null,
          };
        })
        .sort((a, b) => b.dayNum - a.dayNum);
      setEntries(result);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <AppShell>
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <header className={`${PANEL} p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4`}>
          <div>
            <h1 className="text-2xl font-bold text-white">Past Daily Puzzles</h1>
            <p className="text-slate-400 text-sm">Missed a day? Replay any earlier daily puzzle.</p>
            <Link to="/guess" className={`${BACK_LINK} mt-2`}>
              ← Today's Puzzle
            </Link>
          </div>
          <ul className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-300" aria-label="Legend">
            {(["won", "lost", null] as const).map((result) => (
              <li key={String(result)} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-md border ${RESULT_STYLES[String(result)].swatch}`} aria-hidden="true" />
                {RESULT_STYLES[String(result)].label}
              </li>
            ))}
          </ul>
        </header>

        {loading && <p className="text-slate-400 text-center">Loading...</p>}

        {!loading && entries.length === 0 && (
          <p className="text-slate-400 text-center">No past puzzles yet.</p>
        )}

        {entries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {entries.map((entry) => {
              const style = RESULT_STYLES[String(entry.result)];
              const Icon = style.icon;

              return (
                <button
                  key={entry.date}
                  onClick={() => navigate(`/guess?day=${entry.dayNum}`)}
                  className={`rounded-xl border p-3 sm:p-4 flex flex-col items-start gap-1 text-left transition-all hover:-translate-y-0.5 ${style.tile}`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="font-bold text-white">Daily #{entry.dayNum}</span>
                    {Icon && <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />}
                  </span>
                  <span className="text-slate-400 text-xs font-mono">{entry.date}</span>
                  <span className="text-xs font-semibold">{style.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </AppShell>
  );
}
