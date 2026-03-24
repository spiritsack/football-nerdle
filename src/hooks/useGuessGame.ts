import { useState, useCallback, useEffect } from "react";
import { getPlayerWithTeams, ApiError } from "../api/sportsdb";
import type { Player, PlayerWithTeams, FormerTeam } from "../types";
import { SEED_PLAYERS } from "../data/seedPlayers";

type GuessStatus = "idle" | "loading" | "playing" | "won" | "lost";

const MAX_ATTEMPTS = 5;

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDailyPlayerIndex(dateStr: string): number {
  // Simple hash from date string to get a consistent index
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % SEED_PLAYERS.length;
}

// Calculate the day number since a fixed start date
function getDayNumber(dateStr: string): number {
  const start = new Date("2026-03-24");
  const current = new Date(dateStr);
  return Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

interface GuessGameState {
  targetPlayer: PlayerWithTeams | null;
  clubs: FormerTeam[];
  attempts: number;
  status: GuessStatus;
  wrongGuesses: Player[];
  error: string | null;
  isDaily: boolean;
  dailyCompleted: boolean;
}

function getDailyResult(): { date: string; status: "won" | "lost"; attempts: number } | null {
  const stored = localStorage.getItem("football-nerdle-daily-guess");
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function saveDailyResult(status: "won" | "lost", attempts: number) {
  localStorage.setItem(
    "football-nerdle-daily-guess",
    JSON.stringify({ date: getTodayString(), status, attempts })
  );
}

export function useGuessGame() {
  const today = getTodayString();
  const dailyResult = getDailyResult();
  const alreadyPlayedToday = dailyResult?.date === today;

  const [state, setState] = useState<GuessGameState>({
    targetPlayer: null,
    clubs: [],
    attempts: alreadyPlayedToday ? dailyResult.attempts : 0,
    status: alreadyPlayedToday ? dailyResult.status : "loading",
    wrongGuesses: [],
    error: null,
    isDaily: true,
    dailyCompleted: !!alreadyPlayedToday,
  });

  const startDaily = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const index = getDailyPlayerIndex(today);
      const seed = SEED_PLAYERS[index];
      const playerWithTeams = await getPlayerWithTeams(seed);
      if (alreadyPlayedToday) {
        setState((s) => ({
          ...s,
          targetPlayer: playerWithTeams,
          clubs: playerWithTeams.formerTeams,
          status: dailyResult!.status,
          attempts: dailyResult!.attempts,
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
  }, [today, alreadyPlayedToday, dailyResult]);

  const startRandom = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const seed = SEED_PLAYERS[Math.floor(Math.random() * SEED_PLAYERS.length)];
      const playerWithTeams = await getPlayerWithTeams(seed);
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
        setState((s) => ({ ...s, status: "won", attempts: finalAttempts, dailyCompleted: s.isDaily }));
      } else {
        const newAttempts = state.attempts + 1;
        if (newAttempts >= MAX_ATTEMPTS) {
          if (state.isDaily) saveDailyResult("lost", newAttempts);
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

  function getShareText(): string {
    const dayNum = getDayNumber(today);
    const won = state.status === "won";
    const score = won ? `${state.attempts}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`;
    const squares = Array.from({ length: MAX_ATTEMPTS }, (_, i) => {
      if (i < state.attempts - (won ? 1 : 0)) return "🟥";
      if (won && i === state.attempts - 1) return "🟩";
      return "⬛";
    }).join("");
    const mode = state.isDaily ? `#${dayNum}` : "Random";
    return `Football Nerdle ${mode} ${score}\n${squares}\nhttps://spiritsack.github.io/football-nerdle/#/guess`;
  }

  // Auto-start daily on mount
  useEffect(() => {
    startDaily();
  }, [startDaily]);

  return {
    ...state,
    maxAttempts: MAX_ATTEMPTS,
    dayNumber: getDayNumber(today),
    startDaily,
    startRandom,
    submitGuess,
    getShareText,
  };
}
