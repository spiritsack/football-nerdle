import type { GuessDistributionProps } from "./types";

const BUCKETS = [1, 2, 3, 4, 5] as const;

export default function GuessDistribution({ distribution, highlight }: GuessDistributionProps) {
  const maxCount = Math.max(...BUCKETS.map((b) => distribution[b]));

  return (
    <div data-testid="guess-distribution" className="mt-5 pt-4 border-t border-gray-700">
      <h4 className="text-sm font-semibold text-center text-gray-300 mb-3">Guess Distribution</h4>
      {maxCount === 0 ? (
        <p className="text-gray-400 text-sm text-center">
          No daily wins recorded yet. Your guess distribution counts daily games from now on.
        </p>
      ) : (
        <div className="space-y-1.5">
          {BUCKETS.map((bucket) => {
            const count = distribution[bucket];
            const isHighlighted = bucket === highlight;
            const barWidth = (count / maxCount) * 100;
            return (
              <div key={bucket} data-testid={`guess-distribution-row-${bucket}`} className="flex items-center gap-2">
                <span className={`text-xs w-3 shrink-0 text-right ${isHighlighted ? "text-white font-bold" : "text-gray-400"}`}>
                  {bucket}
                </span>
                <div className="flex-1 min-w-0 h-5 bg-gray-700 rounded overflow-hidden">
                  <div
                    className={`h-full rounded transition-all duration-500 ${isHighlighted ? "bg-green-500" : "bg-green-900/60"}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span
                  data-testid="guess-distribution-count"
                  className={`text-xs w-6 shrink-0 ${isHighlighted ? "text-white font-bold" : "text-gray-400"}`}
                >
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
