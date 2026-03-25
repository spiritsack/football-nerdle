import type { Player, PlayerWithTeams, FormerTeam } from "../../types";

export type GuessStatus = "idle" | "loading" | "playing" | "won" | "lost";

export interface GuessGameState {
  targetPlayer: PlayerWithTeams | null;
  clubs: FormerTeam[];
  attempts: number;
  status: GuessStatus;
  wrongGuesses: Player[];
  error: string | null;
  isDaily: boolean;
  dailyCompleted: boolean;
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
