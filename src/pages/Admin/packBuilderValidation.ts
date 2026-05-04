import type { Player } from "../../types";

export interface PackBuilderState {
  clubId: string | null;
  players: (Player | null)[];
  date: string;
  alreadyScheduled: boolean;
  isEditingExisting?: boolean;
}

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

const PACK_SIZE = 10;

export function validatePackForPublish(state: PackBuilderState): ValidationResult {
  if (!state.clubId) return { ok: false, reason: "Pick a club" };
  if (!state.date) return { ok: false, reason: "Pick a date" };

  const todayStr = new Date().toISOString().slice(0, 10);
  if (state.date < todayStr && !state.isEditingExisting) return { ok: false, reason: "Date must be today or future" };
  if (state.alreadyScheduled && !state.isEditingExisting) return { ok: false, reason: "A pack is already scheduled for this date" };

  const filled = state.players.filter((p): p is Player => p !== null);
  if (filled.length !== PACK_SIZE) return { ok: false, reason: `Need ${PACK_SIZE} players (${filled.length} selected)` };

  const ids = new Set(filled.map((p) => p.id));
  if (ids.size !== PACK_SIZE) return { ok: false, reason: "Duplicate players" };

  const missingThumb = filled.find((p) => !p.thumbnail);
  if (missingThumb) return { ok: false, reason: `${missingThumb.name} has no photo` };

  return { ok: true };
}
