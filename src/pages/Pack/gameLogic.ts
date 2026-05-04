import type { Player } from "../../types";
import type { PackData, PackGameState } from "./types";
import { MAX_GUESSES_PER_PLAYER } from "./constants";

export function initialState(pack: PackData): PackGameState {
  return {
    pack,
    currentIndex: 0,
    guessesForCurrent: 0,
    wrongGuessesForCurrent: [],
    status: "playing",
    attempts: [],
    score: 0,
    error: null,
  };
}

function isCorrect(state: PackGameState, guess: Player): boolean {
  const target = state.pack?.players[state.currentIndex];
  if (!target) return false;
  return guess.id === target.id || guess.name.toLowerCase() === target.name.toLowerCase();
}

export function submitGuess(state: PackGameState, guess: Player): PackGameState {
  if (!state.pack || state.status !== "playing") return state;
  const target = state.pack.players[state.currentIndex];
  const guesses = state.guessesForCurrent + 1;
  if (isCorrect(state, guess)) {
    return {
      ...state,
      status: "revealing",
      guessesForCurrent: guesses,
      score: state.score + 1,
      attempts: [...state.attempts, { playerId: target.id, correct: true, guesses }],
    };
  }
  const wrongGuesses = [...state.wrongGuessesForCurrent, guess];
  if (guesses >= MAX_GUESSES_PER_PLAYER) {
    return {
      ...state,
      status: "revealing",
      guessesForCurrent: guesses,
      wrongGuessesForCurrent: wrongGuesses,
      attempts: [...state.attempts, { playerId: target.id, correct: false, guesses }],
    };
  }
  return {
    ...state,
    guessesForCurrent: guesses,
    wrongGuessesForCurrent: wrongGuesses,
  };
}

export function advance(state: PackGameState): PackGameState {
  if (!state.pack || state.status !== "revealing") return state;
  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.pack.players.length) {
    return { ...state, status: "finished" };
  }
  return {
    ...state,
    status: "playing",
    currentIndex: nextIndex,
    guessesForCurrent: 0,
    wrongGuessesForCurrent: [],
  };
}
