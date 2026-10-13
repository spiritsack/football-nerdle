import { describe, it, expect, vi, beforeEach } from "vitest";
import { deriveStatus } from "../pages/MultiplayerBattle/helpers";
import type { GameRoom } from "../types";

const removeItem = vi.fn();
vi.stubGlobal("localStorage", { removeItem });

function room(overrides: Partial<GameRoom>): GameRoom {
  return {
    id: "room-1",
    code: "ABC123",
    status: "playing",
    host_id: "host",
    guest_id: "guest",
    current_turn: "host",
    chain: [],
    used_player_ids: [],
    last_shared_clubs: [],
    turn_started_at: null,
    host_last_seen: null,
    guest_last_seen: null,
    winner: null,
    lose_reason: null,
    score: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("deriveStatus", () => {
  beforeEach(() => removeItem.mockClear());

  it("returns finished and clears the stored session when the room is finished", () => {
    expect(deriveStatus(room({ status: "finished" }), "playing", "host")).toBe("finished");
    expect(removeItem).toHaveBeenCalledOnce();
  });

  it("moves from starting or finished to playing when the room is playing", () => {
    expect(deriveStatus(room({}), "starting", "host")).toBe("playing");
    expect(deriveStatus(room({}), "finished", "host")).toBe("playing");
  });

  it("leaves checking only when the turn comes back to this player", () => {
    expect(deriveStatus(room({ current_turn: "host" }), "checking", "host")).toBe("playing");
    expect(deriveStatus(room({ current_turn: "guest" }), "checking", "host")).toBe("checking");
  });

  it("keeps the previous status while the room is waiting", () => {
    expect(deriveStatus(room({ status: "waiting" }), "starting", "host")).toBe("starting");
    expect(removeItem).not.toHaveBeenCalled();
  });
});
