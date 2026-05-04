import { useCallback, useEffect, useRef, useState } from "react";
import { getPackForDate, getScheduledPackDatesBetween } from "../../api/packSchedule";
import type { Player } from "../../types";
import { initialState, submitGuess as reduceGuess, advance as reduceAdvance } from "./gameLogic";
import type { PackGameState } from "./types";
import { getTodayString } from "../../utils/dates";
import { loadPackResult, savePackResult } from "./helpers";
import { DEFAULT_PACK_STATS, loadPackStats, recordPackResult } from "./stats";
import { PACK_STREAK_THRESHOLD } from "./constants";
import type { PackStats } from "./stats";

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
  const [stats, setStats] = useState<PackStats>(DEFAULT_PACK_STATS);
  const recordedRef = useRef(false);

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
        setStats(loadPackStats());
        const stored = loadPackResult(today);
        if (stored && stored.attempts.length === pack.players.length) {
          recordedRef.current = true;
          setState({
            ...initialState(pack),
            status: "finished",
            attempts: stored.attempts,
            score: stored.score,
            currentIndex: pack.players.length,
          });
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

  useEffect(() => {
    if (state.status !== "finished" || !state.pack) return;
    savePackResult({
      date: state.pack.date,
      score: state.score,
      attempts: state.attempts,
    });

    if (recordedRef.current) return;
    recordedRef.current = true;
    const date = state.pack.date;
    const score = state.score;
    const prior = loadPackStats();

    (async () => {
      const between = prior.lastSuccessDate
        ? await getScheduledPackDatesBetween(prior.lastSuccessDate, date)
        : [];
      const updated = recordPackResult(prior, date, score, between, (d) => {
        const r = loadPackResult(d);
        return !!r && r.score >= PACK_STREAK_THRESHOLD;
      });
      setStats(updated);
    })();
  }, [state.status, state.pack, state.score, state.attempts]);

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

  return { state, submitGuess, advance, today, stats };
}
