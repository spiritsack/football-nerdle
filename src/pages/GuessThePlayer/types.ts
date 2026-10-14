import type { Player, PlayerWithTeams, FormerTeam } from "../../types";

export type GuessStatus = "idle" | "loading" | "playing" | "won" | "lost";

export interface RevealedHints {
  nationality: boolean;
  age: boolean;
  position: boolean;
  photo: boolean;
  initials: boolean;
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
  announcement: string;
}

export type GuessOutcome =
  | { kind: "wrong"; guessName: string; attemptsLeft: number }
  | { kind: "skip"; attemptsLeft: number }
  | { kind: "won"; targetName: string; attempts: number }
  | { kind: "lost"; targetName: string };

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
  lastPlayedDate?: string;
}

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

export type ShareNavigator = Partial<Pick<Navigator, "share" | "canShare" | "clipboard">>;
