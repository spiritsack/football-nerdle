import { useState, useCallback } from "react";
import { getPlayerWithTeams, ApiError } from "../api/sportsdb";
import type { Player, PlayerWithTeams, FormerTeam } from "../types";
import { SEED_PLAYERS } from "../data/seedPlayers";

type GuessStatus = "idle" | "loading" | "playing" | "won" | "lost";

const MAX_ATTEMPTS = 5;

interface GuessGameState {
  targetPlayer: PlayerWithTeams | null;
  clubs: FormerTeam[];
  attempts: number;
  status: GuessStatus;
  wrongGuesses: Player[];
  error: string | null;
}

export function useGuessGame() {
  const [state, setState] = useState<GuessGameState>({
    targetPlayer: null,
    clubs: [],
    attempts: 0,
    status: "idle",
    wrongGuesses: [],
    error: null,
  });

  const startGame = useCallback(async () => {
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
        setState((s) => ({ ...s, status: "won" }));
      } else {
        const newAttempts = state.attempts + 1;
        if (newAttempts >= MAX_ATTEMPTS) {
          setState((s) => ({
            ...s,
            attempts: newAttempts,
            wrongGuesses: [...s.wrongGuesses, player],
            status: "lost",
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
    [state.targetPlayer, state.status, state.attempts]
  );

  return {
    ...state,
    maxAttempts: MAX_ATTEMPTS,
    startGame,
    submitGuess,
  };
}
