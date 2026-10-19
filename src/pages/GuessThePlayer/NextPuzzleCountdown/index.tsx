import { useEffect, useState } from "react";
import { getMsUntilNextDay } from "../../../utils/dates";
import { formatCountdown } from "../helpers";
import { BTN_LG, BTN_PRIMARY } from "../../../theme";
import type { NextPuzzleCountdownProps } from "./types";

export default function NextPuzzleCountdown({ today }: NextPuzzleCountdownProps) {
  const [msLeft, setMsLeft] = useState(() => getMsUntilNextDay(today));

  useEffect(() => {
    if (getMsUntilNextDay(today) <= 0) return;
    // Recompute from the wall clock on every tick: no drift, correct after the tab sleeps.
    const id = setInterval(() => {
      const left = getMsUntilNextDay(today);
      setMsLeft(left);
      if (left <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [today]);

  if (msLeft > 0) {
    return (
      <p role="timer" data-testid="next-puzzle-countdown" className="text-slate-400 text-center text-sm">
        Next puzzle in <span className="font-mono font-semibold text-pitch-400 text-base">{formatCountdown(msLeft)}</span>
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p className="text-slate-300">New puzzle available!</p>
      <button
        onClick={() => window.location.reload()}
        className={`${BTN_PRIMARY} ${BTN_LG}`}
      >
        Play new daily
      </button>
    </div>
  );
}
