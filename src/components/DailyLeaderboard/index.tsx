import { useState, useEffect } from "react";
import { getDailyLeaderboard, type LeaderboardEntry } from "../../api/dailyLeaderboard";

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
    <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 max-w-md w-full">
      <h3 className="text-lg font-semibold text-center text-gray-300 mb-4">
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
              <span className={`text-xs w-14 shrink-0 text-right ${isUser ? "text-white font-bold" : "text-gray-400"}`}>
                {ROW_LABELS[bucket]}
              </span>
              <div className="flex-1 h-6 bg-gray-700 rounded overflow-hidden relative">
                <div
                  className={`h-full rounded transition-all duration-500 ${
                    isUser
                      ? isFail ? "bg-red-500" : "bg-green-500"
                      : isFail ? "bg-red-900/60" : "bg-green-900/60"
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className={`text-xs w-14 shrink-0 ${isUser ? "text-white font-bold" : "text-gray-500"}`}>
                {count} <span className="text-gray-600">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
