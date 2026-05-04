import { useCallback, useEffect, useState } from "react";
import { getPackForDate } from "../../api/packSchedule";
import type { Player } from "../../types";
import { initialState, submitGuess as reduceGuess, advance as reduceAdvance } from "./gameLogic";
import type { PackGameState } from "./types";
import { getTodayString } from "../../utils/dates";

const REVEAL_MS = 1500;

const EMPTY: PackGameState = {
  pack: null,
  currentIndex: 0,
  guessesForCurrent: 0,
  wrongGuessesForCurrent: [],
  status: "loading",
  attempts: [],
  score: 0,
  error: null,
};

export function usePackGame() {
  const [today] = useState(getTodayString);
  const [state, setState] = useState<PackGameState>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pack = await getPackForDate(today);
        if (cancelled) return;
        if (!pack) {
          setState({ ...EMPTY, status: "idle", error: "No pack scheduled for today." });
          return;
        }
        setState(initialState(pack));
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Something went wrong";
        setState({ ...EMPTY, status: "idle", error: message });
      }
    })();
    return () => { cancelled = true; };
  }, [today]);

  const submitGuess = useCallback((guess: Player) => {
    setState((s) => reduceGuess(s, guess));
  }, []);

  const advance = useCallback(() => {
    setState((s) => reduceAdvance(s));
  }, []);

  useEffect(() => {
    if (state.status !== "revealing") return;
    const id = setTimeout(() => {
      setState((s) => (s.status === "revealing" ? reduceAdvance(s) : s));
    }, REVEAL_MS);
    return () => clearTimeout(id);
  }, [state.status, state.currentIndex]);

  return { state, submitGuess, advance, today };
}
