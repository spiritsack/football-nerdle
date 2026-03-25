import { useState, useCallback, useRef, useEffect } from "react";
import { didPlayTogether, ApiError } from "../api/sportsdb";
import { getPlayerWithTeamsCached } from "../api/playerCache";
import type { Player, PlayerWithTeams } from "../types";
import { SEED_PLAYERS } from "../data/seedPlayers";

type GameStatus = "idle" | "loading" | "playing" | "checking" | "wrong" | "gameover";

interface WrongResult {
  player: Player;
  checkedClubs: { a: string[]; b: string[] };
}

interface GameState {
  chain: PlayerWithTeams[];
  currentPlayer: PlayerWithTeams | null;
  score: number;
  status: GameStatus;
  lastSharedClubs: string[];
  wrongResult: WrongResult | null;
  usedPlayerIds: Set<string>;
  timedOut: boolean;
  error: string | null;
}

const TURN_TIME = 15;
const BEST_STREAK_KEY = "football-nerdle-best-streak";

function loadBestStreak(): number {
  const stored = localStorage.getItem(BEST_STREAK_KEY);
  return stored ? parseInt(stored, 10) || 0 : 0;
}

function saveBestStreak(score: number, current: number, setBestStreak: (n: number) => void) {
  if (score > current) {
    localStorage.setItem(BEST_STREAK_KEY, String(score));
    setBestStreak(score);
  }
}

export function useGame() {
  const [bestStreak, setBestStreak] = useState(loadBestStreak);
  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);
  const [state, setState] = useState<GameState>({
    chain: [],
    currentPlayer: null,
    score: 0,
    status: "idle",
    lastSharedClubs: [],
    wrongResult: null,
    usedPlayerIds: new Set(),
    timedOut: false,
    error: null,
  });

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setTimeLeft(TURN_TIME);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [stopTimer]);

  // Handle timeout
  useEffect(() => {
    if (timeLeft === 0 && state.status === "playing") {
      saveBestStreak(state.score, loadBestStreak(), setBestStreak);
      setState((s) => ({ ...s, status: "gameover", timedOut: true }));
    }
  }, [timeLeft, state.status, state.score]);

  // Cleanup on unmount
  useEffect(() => stopTimer, [stopTimer]);

  const startGame = useCallback(async () => {
    stopTimer();
    setState((s) => ({ ...s, status: "loading", wrongResult: null, timedOut: false, error: null }));
    try {
      const seed = SEED_PLAYERS[Math.floor(Math.random() * SEED_PLAYERS.length)];
      const playerWithTeams = await getPlayerWithTeamsCached(seed);
      setState({
        chain: [playerWithTeams],
        currentPlayer: playerWithTeams,
        score: 0,
        status: "playing",
        lastSharedClubs: [],
        wrongResult: null,
        usedPlayerIds: new Set([playerWithTeams.id]),
        timedOut: false,
        error: null,
      });
      startTimer();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Something went wrong";
      setState((s) => ({ ...s, status: "gameover", error: message }));
    }
  }, [startTimer, stopTimer]);

  const submitPlayer = useCallback(
    async (player: Player) => {
      if (!state.currentPlayer) return;
      if (state.usedPlayerIds.has(player.id)) return;
      stopTimer();
      setState((s) => ({ ...s, status: "checking", error: null }));

      try {
        const playerWithTeams = await getPlayerWithTeamsCached(player);
        const result = didPlayTogether(state.currentPlayer, playerWithTeams);

        if (result.together) {
          setState((s) => {
            const newUsed = new Set(s.usedPlayerIds);
            newUsed.add(playerWithTeams.id);
            return {
              ...s,
              chain: [...s.chain, playerWithTeams],
              currentPlayer: playerWithTeams,
              score: s.score + 1,
              status: "playing",
              lastSharedClubs: result.clubs,
              usedPlayerIds: newUsed,
            };
          });
          startTimer();
        } else {
          setState((s) => {
            saveBestStreak(s.score, loadBestStreak(), setBestStreak);
            return {
              ...s,
              status: "gameover",
              wrongResult: {
                player,
                checkedClubs: {
                  a: s.currentPlayer!.formerTeams.map((t) => t.teamName),
                  b: playerWithTeams.formerTeams.map((t) => t.teamName),
                },
              },
            };
          });
        }
      } catch (e) {
        const message = e instanceof ApiError ? e.message : "Something went wrong";
        setState((s) => ({ ...s, status: "playing", error: message }));
        startTimer();
      }
    },
    [state.currentPlayer, state.usedPlayerIds, stopTimer, startTimer]
  );

  return {
    ...state,
    bestStreak,
    timeLeft,
    startGame,
    submitPlayer,
  };
}
