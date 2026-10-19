import type { GuessDistributionProps } from "./types";

const BUCKETS = [1, 2, 3, 4, 5] as const;

export default function GuessDistribution({ distribution, highlight }: GuessDistributionProps) {
  const maxCount = Math.max(...BUCKETS.map((b) => distribution[b]));

  return (
    <div data-testid="guess-distribution" className="mt-5 pt-4 border-t border-slate-800">
      <h4 className="text-xs font-bold uppercase tracking-wider text-center text-slate-300 mb-3">Guess Distribution</h4>
      {maxCount === 0 ? (
        <p className="text-slate-400 text-sm text-center">
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
                <span className={`text-xs w-3 shrink-0 text-right ${isHighlighted ? "text-pitch-400 font-bold" : "text-slate-400 font-bold"}`}>
                  {bucket}
                </span>
                <div className="flex-1 min-w-0 h-4 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isHighlighted ? "bg-pitch-500" : "bg-pitch-500/35"}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span
                  data-testid="guess-distribution-count"
                  className={`text-xs w-6 shrink-0 ${isHighlighted ? "text-white font-bold" : "text-slate-400"}`}
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
