import { useState, useCallback, useEffect } from "react";
import { ApiError } from "../../api/sportsdb";
import { getPlayerWithTeamsCached } from "../../api/playerCache";
import { refreshPoolIfNeeded, getRandomPoolPlayer } from "../../api/playerPool";
import type { Player } from "../../types";
import { SEED_PLAYERS } from "../../data/seedPlayers";
import { MAX_ATTEMPTS, SHARE_URL } from "./constants";
import type { GuessGameState, GuessStats } from "./types";
import { getTodayString, getDailyPlayerIndex, getDayNumber, getDailyResult, saveDailyResult, loadStats, recordResult } from "./helpers";

export function useGuessGame() {
  const [today] = useState(getTodayString);
  const [dailyResult] = useState(getDailyResult);
  const alreadyPlayedToday = dailyResult?.date === today;
  const [stats, setStats] = useState<GuessStats>(loadStats);

  const [state, setState] = useState<GuessGameState>(() => ({
    targetPlayer: null,
    clubs: [],
    attempts: alreadyPlayedToday ? dailyResult.attempts : 0,
    status: "loading",
    wrongGuesses: [],
    error: null,
    isDaily: true,
    dailyCompleted: !!alreadyPlayedToday,
  }));

  const startDaily = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const index = getDailyPlayerIndex(today);
      const seed = SEED_PLAYERS[index];
      const playerWithTeams = await getPlayerWithTeamsCached(seed);
      const stored = getDailyResult();
      const completed = stored?.date === today;
      if (completed) {
        setState((s) => ({
          ...s,
          targetPlayer: playerWithTeams,
          clubs: playerWithTeams.formerTeams,
          status: stored.status,
          attempts: stored.attempts,
          isDaily: true,
          dailyCompleted: true,
        }));
      } else {
        setState({
          targetPlayer: playerWithTeams,
          clubs: playerWithTeams.formerTeams,
          attempts: 0,
          status: "playing",
          wrongGuesses: [],
          error: null,
          isDaily: true,
          dailyCompleted: false,
        });
      }
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Something went wrong — check your API key";
      setState((s) => ({ ...s, status: "idle", error: message }));
    }
  }, [today]);

  const startRandom = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    // Trigger daily pool refresh in background (fire-and-forget)
    refreshPoolIfNeeded();
    try {
      const playerWithTeams = await getRandomPoolPlayer();
      setState({
        targetPlayer: playerWithTeams,
        clubs: playerWithTeams.formerTeams,
        attempts: 0,
        status: "playing",
        wrongGuesses: [],
        error: null,
        isDaily: false,
        dailyCompleted: false,
      });
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Something went wrong";
      setState((s) => ({ ...s, status: "idle", error: message }));
    }
  }, []);

  const submitGuess = useCallback(
    (player: Player) => {
      if (!state.targetPlayer || state.status !== "playing") return;

      if (player.id === state.targetPlayer.id) {
        const finalAttempts = state.attempts + 1;
        if (state.isDaily) saveDailyResult("won", finalAttempts);
        setStats(recordResult(true));
        setState((s) => ({ ...s, status: "won", attempts: finalAttempts, dailyCompleted: s.isDaily }));
      } else {
        const newAttempts = state.attempts + 1;
        if (newAttempts >= MAX_ATTEMPTS) {
          if (state.isDaily) saveDailyResult("lost", newAttempts);
          setStats(recordResult(false));
          setState((s) => ({
            ...s,
            attempts: newAttempts,
            wrongGuesses: [...s.wrongGuesses, player],
            status: "lost",
            dailyCompleted: s.isDaily,
          }));
        } else {
          setState((s) => ({
            ...s,
            attempts: newAttempts,
            wrongGuesses: [...s.wrongGuesses, player],
          }));
        }
      }
    },
    [state.targetPlayer, state.status, state.attempts, state.isDaily]
  );

  function getShareText(hardMode?: boolean): string {
    const dayNum = getDayNumber(today);
    const won = state.status === "won";
    const score = won ? `${state.attempts}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`;
    const wrongCount = won ? state.attempts - 1 : state.attempts;
    const squares = Array.from({ length: MAX_ATTEMPTS }, (_, i) => {
      if (i < wrongCount) return "🟥";
      return won ? "🟩" : "⬛";
    }).join("");
    const mode = state.isDaily ? `#${dayNum}` : "Random";
    const hardIndicator = hardMode ? "*" : "";
    return `Football Nerdle ${mode} ${score}${hardIndicator}\n${squares}\n${SHARE_URL}`;
  }

  // Auto-start daily on mount
  useEffect(() => {
    startDaily();
  }, [startDaily]);

  return {
    ...state,
    stats,
    maxAttempts: MAX_ATTEMPTS,
    dayNumber: getDayNumber(today),
    startDaily,
    startRandom,
    submitGuess,
    getShareText,
  };
}
