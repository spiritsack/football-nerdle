import { SESSION_KEY } from "./constants";
import type { GameRoom } from "../../types";
import type { MultiplayerGameStatus, StoredSession } from "./types";

export function saveSession(roomId: string, playerId: string, isHost: boolean) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, playerId, isHost }));
}

export function loadSession(): StoredSession | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function deriveStatus(room: GameRoom, prev: MultiplayerGameStatus, playerId: string): MultiplayerGameStatus {
  if (room.status === "finished") {
    clearSession();
    return "finished";
  }
  if (room.status === "playing") {
    if (prev === "starting" || prev === "finished") return "playing";
    if (prev === "checking" && room.current_turn === playerId) return "playing";
    return prev;
  }
  return prev;
}
