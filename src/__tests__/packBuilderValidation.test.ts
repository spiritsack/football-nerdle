import { describe, it, expect } from "vitest";
import { validatePackForPublish } from "../pages/Admin/packBuilderValidation";
import type { Player } from "../types";

function makePlayer(id: string, thumbnail = "https://example.com/x.jpg"): Player {
  return { id, name: `Player ${id}`, thumbnail, nationality: "Brazil" };
}

const FUTURE_DATE = "2099-01-01";

function tenPlayers(): Player[] {
  return Array.from({ length: 10 }, (_, i) => makePlayer(`p${i + 1}`));
}

describe("validatePackForPublish", () => {
  it("rejects when no club is picked", () => {
    const r = validatePackForPublish({
      clubId: null,
      players: tenPlayers(),
      date: FUTURE_DATE,
      alreadyScheduled: false,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/club/i);
  });

  it("rejects when date is missing", () => {
    const r = validatePackForPublish({
      clubId: "club-1",
      players: tenPlayers(),
      date: "",
      alreadyScheduled: false,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/date/i);
  });

  it("rejects when date is in the past", () => {
    const r = validatePackForPublish({
      clubId: "club-1",
      players: tenPlayers(),
      date: "2000-01-01",
      alreadyScheduled: false,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/today or future/i);
  });

  it("rejects when the date already has a pack scheduled", () => {
    const r = validatePackForPublish({
      clubId: "club-1",
      players: tenPlayers(),
      date: FUTURE_DATE,
      alreadyScheduled: true,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/already scheduled/i);
  });

  it("rejects when fewer than 10 players are selected", () => {
    const r = validatePackForPublish({
      clubId: "club-1",
      players: [...tenPlayers().slice(0, 5), null, null, null, null, null],
      date: FUTURE_DATE,
      alreadyScheduled: false,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Need 10 players/);
  });

  it("rejects when a selected player has no thumbnail", () => {
    const players = tenPlayers();
    players[3] = { ...players[3], thumbnail: "" };
    const r = validatePackForPublish({
      clubId: "club-1",
      players,
      date: FUTURE_DATE,
      alreadyScheduled: false,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/no photo/i);
  });

  it("rejects on duplicate player ids", () => {
    const players = tenPlayers();
    players[5] = makePlayer("p1");  // duplicate of slot 0
    const r = validatePackForPublish({
      clubId: "club-1",
      players,
      date: FUTURE_DATE,
      alreadyScheduled: false,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/duplicate/i);
  });

  it("passes when all conditions are met", () => {
    const r = validatePackForPublish({
      clubId: "club-1",
      players: tenPlayers(),
      date: FUTURE_DATE,
      alreadyScheduled: false,
    });
    expect(r.ok).toBe(true);
    expect(r.reason).toBeUndefined();
  });

  it("allows editing an existing scheduled pack on the same date", () => {
    const r = validatePackForPublish({
      clubId: "club-1",
      players: tenPlayers(),
      date: FUTURE_DATE,
      alreadyScheduled: true,
      isEditingExisting: true,
    });
    expect(r.ok).toBe(true);
  });

  it("allows editing a pack on a past date (e.g. fixing yesterday's pack)", () => {
    const r = validatePackForPublish({
      clubId: "club-1",
      players: tenPlayers(),
      date: "2000-01-01",
      alreadyScheduled: true,
      isEditingExisting: true,
    });
    expect(r.ok).toBe(true);
  });
});
