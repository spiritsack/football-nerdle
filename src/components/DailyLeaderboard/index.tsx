import { useState, useEffect } from "react";
import { getDailyLeaderboard, type LeaderboardEntry } from "../../api/dailyLeaderboard";
import { PANEL, SECTION_LABEL } from "../../theme";

const ROW_LABELS: Record<number, string> = {
  1: "1st try",
  2: "2nd try",
  3: "3rd try",
  4: "4th try",
  5: "5th try",
  0: "Failed",
};

const ALL_BUCKETS = [1, 2, 3, 4, 5, 0];

interface Props {
  date: string;
  userAttempts: number; // 1-5 for win, 0 for loss
}

export default function DailyLeaderboard({ date, userAttempts }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDailyLeaderboard(date).then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, [date]);

  if (loading) return null;

  const countMap = new Map(entries.map((e) => [e.attempts, e.count]));

  // Optimistically include the user's result if not yet in the data
  const userCount = countMap.get(userAttempts) ?? 0;
  if (userCount === 0) {
    countMap.set(userAttempts, 1);
  }

  const total = [...countMap.values()].reduce((sum, c) => sum + c, 0);
  const maxCount = Math.max(...ALL_BUCKETS.map((b) => countMap.get(b) ?? 0), 1);

  if (total === 0) return null;

  return (
    <div className={`${PANEL} p-5 sm:p-6 w-full`}>
      <h3 className={`${SECTION_LABEL} text-center mb-4`}>
        Today's Results
      </h3>
      <div className="space-y-2">
        {ALL_BUCKETS.map((bucket) => {
          const count = countMap.get(bucket) ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
          const isUser = bucket === userAttempts;
          const isFail = bucket === 0;

          return (
            <div key={bucket} className="flex items-center gap-3">
              <span className={`text-xs w-14 shrink-0 text-right ${isUser ? "text-white font-bold" : "text-slate-400"}`}>
                {ROW_LABELS[bucket]}
              </span>
              <div className="flex-1 h-4 bg-slate-800 rounded-full overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isUser
                      ? isFail ? "bg-rose-500" : "bg-pitch-500"
                      : isFail ? "bg-rose-500/30" : "bg-pitch-500/35"
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className={`text-xs w-14 shrink-0 ${isUser ? "text-white font-bold" : "text-slate-500"}`}>
                {count} <span className="text-slate-600">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
