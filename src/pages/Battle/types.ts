import type { Player, PlayerWithTeams } from "../../types";

export type GameStatus = "idle" | "loading" | "playing" | "checking" | "wrong" | "gameover";

export interface WrongResult {
  player: Player;
  checkedClubs: { a: string[]; b: string[] };
}

export interface GameState {
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
