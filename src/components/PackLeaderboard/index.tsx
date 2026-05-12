import { useEffect, useState } from "react";
import { getPackLeaderboard, type PackLeaderboardEntry } from "../../api/packLeaderboard";

interface Props {
  date: string;
  userScore: number;
  packSize: number;
}

export default function PackLeaderboard({ date, userScore, packSize }: Props) {
  const allBuckets = Array.from({ length: packSize + 1 }, (_, i) => packSize - i);
  const [entries, setEntries] = useState<PackLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPackLeaderboard(date).then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, [date]);

  if (loading) return null;

  const countMap = new Map(entries.map((e) => [e.score, e.count]));

  // Optimistically include the user's score if not yet present.
  if ((countMap.get(userScore) ?? 0) === 0) {
    countMap.set(userScore, 1);
  }

  const total = [...countMap.values()].reduce((sum, c) => sum + c, 0);
  const maxCount = Math.max(...allBuckets.map((b) => countMap.get(b) ?? 0), 1);

  if (total === 0) return null;

  return (
    <div aria-label="Today's results" className="bg-gray-800 border border-gray-600 rounded-xl p-6 max-w-md w-full">
      <h3 className="text-lg font-semibold text-center text-gray-300 mb-4">Today's Results</h3>
      <div className="space-y-2">
        {allBuckets.map((bucket) => {
          const count = countMap.get(bucket) ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
          const isUser = bucket === userScore;

          return (
            <div key={bucket} className="flex items-center gap-3">
              <span className={`text-xs w-12 shrink-0 text-right ${isUser ? "text-white font-bold" : "text-gray-400"}`}>
                {bucket}/{packSize}
              </span>
              <div className="flex-1 h-6 bg-gray-700 rounded overflow-hidden relative">
                <div
                  className={`h-full rounded transition-all duration-500 ${
                    isUser ? "bg-green-500" : "bg-green-900/60"
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
