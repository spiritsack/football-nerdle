import { SESSION_KEY } from "./constants";
import type { StoredSession } from "./types";

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
