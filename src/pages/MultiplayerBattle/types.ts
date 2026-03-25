import type { Player, GameRoom } from "../../types";

export type LobbyStatus = "idle" | "creating" | "waiting" | "joining" | "reconnecting" | "ready" | "error";

export interface LobbyState {
  status: LobbyStatus;
  room: GameRoom | null;
  playerId: string | null;
  isHost: boolean;
  error: string | null;
}

export interface StoredSession {
  roomId: string;
  playerId: string;
  isHost: boolean;
}

export type MultiplayerGameStatus = "starting" | "playing" | "checking" | "finished";

export interface WrongResult {
  player: Player;
  checkedClubs: { a: string[]; b: string[] };
}

export interface MultiplayerGameState {
  room: GameRoom;
  status: MultiplayerGameStatus;
  error: string | null;
  wrongResult: WrongResult | null;
}
