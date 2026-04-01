import type { Player, PlayerWithTeams, FormerTeam } from "../../types";

export type GuessStatus = "idle" | "loading" | "playing" | "won" | "lost";

export interface RevealedHints {
  nationality: boolean;
  age: boolean;
  position: boolean;
  nameLetters: boolean;
}

export interface GuessGameState {
  targetPlayer: PlayerWithTeams | null;
  clubs: FormerTeam[];
  attempts: number;
  status: GuessStatus;
  wrongGuesses: Player[];
  error: string | null;
  isDaily: boolean;
  isArchive: boolean;
  dayNumber: number | null;
  dailyCompleted: boolean;
  hints: RevealedHints;
}

export interface ArchiveEntry {
  date: string;
  dayNumber: number;
  playerId: string;
  result: DailyResult | null;
}

export interface DailyResult {
  date: string;
  status: "won" | "lost";
  attempts: number;
}

export interface GuessStats {
  played: number;
  won: number;
  lost: number;
  streak: number;
  longestStreak: number;
}
