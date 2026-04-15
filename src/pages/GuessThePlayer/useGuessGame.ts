import { useState, useCallback, useEffect } from "react";
import { getPlayerWithTeamsCached, getFromCacheById, getRandomCachedPlayer } from "../../api/playerCache";
import { getOrCreateDailyPlayer, getScheduledPlayerForDate } from "../../api/dailySchedule";
import { submitDailyResult } from "../../api/dailyLeaderboard";
import type { Player } from "../../types";
import { MAX_ATTEMPTS, SHARE_URL } from "./constants";
import type { GuessGameState, GuessStats, RevealedHints } from "./types";
import {
  getTodayString, getDailyPlayerIndex, getDayNumber, getDateForDay,
  getDailyResult, getDailyResultForDate, saveDailyResult, saveDailyResultForDate,
  loadStats, recordResult
} from "./helpers";

const NO_HINTS: RevealedHints = { nationality: false, age: false, position: false, photo: false, initials: false };

function hintsForWrongCount(wrongCount: number): RevealedHints {
  return {
    nationality: wrongCount >= 1,
    age: wrongCount >= 2,
    position: wrongCount >= 3,
    photo: wrongCount >= 4,
    initials: wrongCount >= 4,
  };
}

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
    isArchive: false,
    dayNumber: null,
    dailyCompleted: !!alreadyPlayedToday,
    hints: NO_HINTS,
  }));

  const startDaily = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const seed = await getOrCreateDailyPlayer(today);
      const playerWithTeams = await getPlayerWithTeamsCached(seed);
      const stored = getDailyResult();
      const completed = stored?.date === today;
      const dayNum = getDayNumber(today);
      if (completed) {
        setState((s) => ({
          ...s,
          targetPlayer: playerWithTeams,
          clubs: playerWithTeams.formerTeams,
          status: stored.status,
          attempts: stored.attempts,
          isDaily: true,
          isArchive: false,
          dayNumber: dayNum,
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
          isArchive: false,
          dayNumber: dayNum,
          dailyCompleted: false,
          hints: NO_HINTS,
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      setState((s) => ({ ...s, status: "idle", error: message }));
    }
  }, [today]);

  const loadArchiveDay = useCallback(async (dayNum: number) => {
    const todayNum = getDayNumber(today);
    if (dayNum > todayNum || dayNum < 1) {
      setState((s) => ({ ...s, status: "idle", error: "This day hasn't happened yet.", isArchive: true, dayNumber: dayNum }));
      return;
    }
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const date = getDateForDay(dayNum);
      const seed = await getScheduledPlayerForDate(date);
      if (!seed) {
        // Fallback to sequential if not in schedule
        const { SEED_PLAYERS } = await import("../../data/seedPlayers");
        const fallbackSeed = SEED_PLAYERS[getDailyPlayerIndex(date)];
        const playerWithTeams = await getPlayerWithTeamsCached(fallbackSeed);
        const stored = getDailyResultForDate(date);
        setState({
          targetPlayer: playerWithTeams,
          clubs: playerWithTeams.formerTeams,
          attempts: stored?.attempts ?? 0,
          status: stored?.status ?? "playing",
          wrongGuesses: [],
          error: null,
          isDaily: false,
          isArchive: true,
          dayNumber: dayNum,
          dailyCompleted: !!stored,
          hints: NO_HINTS,
        });
        return;
      }
      const playerWithTeams = await getPlayerWithTeamsCached(seed);
      const stored = getDailyResultForDate(date);
      setState({
        targetPlayer: playerWithTeams,
        clubs: playerWithTeams.formerTeams,
        attempts: stored?.attempts ?? 0,
        status: stored?.status ?? "playing",
        wrongGuesses: [],
        error: null,
        isDaily: false,
        isArchive: true,
        dayNumber: dayNum,
        dailyCompleted: !!stored,
        hints: NO_HINTS,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      setState((s) => ({ ...s, status: "idle", error: message, dayNumber: dayNum, isArchive: true }));
    }
  }, []);

  const startRandom = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const playerWithTeams = await getRandomCachedPlayer();
      if (!playerWithTeams) throw new Error("No players available");
      setState({
        targetPlayer: playerWithTeams,
        clubs: playerWithTeams.formerTeams,
        attempts: 0,
        status: "playing",
        wrongGuesses: [],
        error: null,
        isDaily: false,
        isArchive: false,
        dayNumber: null,
        dailyCompleted: false,
        hints: NO_HINTS,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      setState((s) => ({ ...s, status: "idle", error: message }));
    }
  }, []);

  const submitGuess = useCallback(
    (player: Player) => {
      if (!state.targetPlayer || state.status !== "playing") return;

      const isCorrect = player.id === state.targetPlayer.id ||
        player.name.toLowerCase() === state.targetPlayer.name.toLowerCase();

      if (isCorrect) {
        const finalAttempts = state.attempts + 1;
        if (state.isDaily) {
          saveDailyResult("won", finalAttempts);
          setStats(recordResult(true));
          submitDailyResult(today, true, finalAttempts);
        } else if (state.isArchive && state.dayNumber) {
          // Save archive result per-date but don't affect stats/streak
          const archiveDate = getDateForDay(state.dayNumber);
          saveDailyResultForDate(archiveDate, "won", finalAttempts);
          submitDailyResult(archiveDate, true, finalAttempts);
        }
        setState((s) => ({ ...s, status: "won", attempts: finalAttempts, dailyCompleted: s.isDaily }));
      } else {
        const newAttempts = state.attempts + 1;
        const newHints = hintsForWrongCount(newAttempts);
        if (newAttempts >= MAX_ATTEMPTS) {
          if (state.isDaily) {
            saveDailyResult("lost", newAttempts);
            setStats(recordResult(false));
            submitDailyResult(today, false, newAttempts);
          } else if (state.isArchive && state.dayNumber) {
            const archiveDate = getDateForDay(state.dayNumber);
            saveDailyResultForDate(archiveDate, "lost", newAttempts);
            submitDailyResult(archiveDate, false, newAttempts);
          }
          setState((s) => ({
            ...s,
            attempts: newAttempts,
            wrongGuesses: [...s.wrongGuesses, player],
            status: "lost",
            dailyCompleted: s.isDaily,
            hints: newHints,
          }));
        } else {
          setState((s) => ({
            ...s,
            attempts: newAttempts,
            wrongGuesses: [...s.wrongGuesses, player],
            hints: newHints,
          }));
        }
      }
    },
    [state.targetPlayer, state.status, state.attempts, state.isDaily, state.isArchive, state.dayNumber]
  );

  function getShareText(hardMode?: boolean): string {
    const dayNum = state.dayNumber ?? getDayNumber(today);
    const won = state.status === "won";
    const score = won ? `${state.attempts}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`;
    const wrongCount = won ? state.attempts - 1 : state.attempts;
    const squares = Array.from({ length: MAX_ATTEMPTS }, (_, i) => {
      if (i < wrongCount) return "🔴";
      return won ? "🟢" : "⬛";
    }).join("");
    const mode = state.isArchive ? `#${dayNum} (Archive)` : state.isDaily ? `#${dayNum}` : "Random";
    const hardIndicator = hardMode ? "*" : "";
    const hintCount = wrongCount;
    const hintIndicator = hintCount > 0 ? ` (${hintCount} hint${hintCount > 1 ? "s" : ""})` : "";
    const shareUrl = state.isArchive ? `${SHARE_URL}?day=${dayNum}` : SHARE_URL;
    return `Football Nerdle ${mode} ${score}${hardIndicator}${hintIndicator}\n${squares}\n${shareUrl}`;
  }

  // Debug: start specific player by ID
  const startById = useCallback(async (id: string) => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const playerWithTeams = await getFromCacheById(id);
      if (!playerWithTeams) throw new Error(`Player ${id} not found in cache`);
      setState({
        targetPlayer: playerWithTeams,
        clubs: playerWithTeams.formerTeams,
        attempts: 0,
        status: "playing",
        wrongGuesses: [],
        error: null,
        isDaily: false,
        isArchive: false,
        dayNumber: null,
        dailyCompleted: false,
        hints: NO_HINTS,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      setState((s) => ({ ...s, status: "idle", error: message }));
    }
  }, []);

  // Auto-start on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const id = params.get("id");
    const day = params.get("day");
    if (day) {
      loadArchiveDay(parseInt(day, 10));
    } else if (id) {
      startById(id);
    } else if (params.get("mode") === "random") {
      startRandom();
    } else {
      startDaily();
    }
  }, [startDaily, startRandom, startById, loadArchiveDay]);

  return {
    ...state,
    stats,
    maxAttempts: MAX_ATTEMPTS,
    today,
    loadArchiveDay,
    startDaily,
    startRandom,
    submitGuess,
    getShareText,
  };
}
