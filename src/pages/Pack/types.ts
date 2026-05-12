import type { Player, PlayerWithTeams } from "../../types";

export type PackStatus = "loading" | "idle" | "playing" | "revealing" | "finished";

export interface PackClub {
  id: string;
  name: string;
  badge: string;
}

export interface PackData {
  date: string;
  club: PackClub;
  players: PlayerWithTeams[];
}

export interface PackAttempt {
  playerId: string;
  correct: boolean;
  guesses: number;
  skipped?: boolean;
}

export interface PackGameState {
  pack: PackData | null;
  currentIndex: number;
  guessesForCurrent: number;
  wrongGuessesForCurrent: Player[];
  status: PackStatus;
  attempts: PackAttempt[];
  score: number;
  error: string | null;
}
