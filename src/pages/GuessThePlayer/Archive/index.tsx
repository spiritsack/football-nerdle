import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAllScheduledDays } from "../../../api/dailySchedule";
import { getDayNumber, getDailyResultForDate } from "../helpers";
import { SEED_PLAYERS } from "../../../data/seedPlayers";
import PageLayout from "../../../components/PageLayout";
import PageHeader from "../../../components/PageHeader";

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
    <PageLayout>
      <PageHeader
        subtitle="Past Daily Puzzles"
        links={[{ to: "/guess", label: "← Today's Puzzle" }]}
      />

      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-3 max-w-lg mx-auto w-full">
        {loading && <p className="text-text-muted">Loading...</p>}

        {!loading && entries.length === 0 && (
          <p className="text-text-muted">No past puzzles yet.</p>
        )}

        {entries.map((entry) => {
          const resultIcon = entry.result === "won" ? "🟢" : entry.result === "lost" ? "🔴" : "⬜";
          const resultLabel = entry.result === "won" ? "Solved" : entry.result === "lost" ? "Failed" : "Not played";

          return (
            <button
              key={entry.date}
              onClick={() => navigate(`/guess?day=${entry.dayNum}`)}
              className="w-full flex items-center justify-between bg-surface-card border border-border-subtle hover:border-border-accent rounded-xl px-5 py-4 transition-colors text-left"
            >
              <div>
                <p className="font-semibold">Daily #{entry.dayNum}</p>
                <p className="text-text-muted text-sm">{entry.date}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <span>{resultLabel}</span>
                <span className="text-lg">{resultIcon}</span>
              </div>
            </button>
          );
        })}
      </main>
    </PageLayout>
  );
}
