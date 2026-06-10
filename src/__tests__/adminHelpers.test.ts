import { describe, it, expect } from "vitest";
import { reshuffleSuggestions, reorderList, movePlayerBetweenDays } from "../pages/Admin/helpers";
import type { DayState } from "../pages/Admin/types";
import type { Player } from "../types";

function player(id: string): Player {
  return { id, name: `Player ${id}`, thumbnail: "", nationality: "Norway" };
}

function day(date: string, assigned: Player | null = null, suggestion: Player | null = null): DayState {
  return { date, assignedPlayer: assigned, suggestion };
}

const TODAY = "2026-06-10";

describe("reshuffleSuggestions", () => {
  it("leaves past days and assigned days untouched", () => {
    const past = day("2026-06-09", null, player("old"));
    const assigned = day("2026-06-10", player("a"), null);
    const open = day("2026-06-11");
    const result = reshuffleSuggestions([past, assigned, open], [player("x")], TODAY, () => 0);
    expect(result[0]).toBe(past);
    expect(result[1]).toBe(assigned);
    expect(result[2].suggestion?.id).toBe("x");
  });

  it("fills open days from the pool without repeats", () => {
    const days = [day("2026-06-10"), day("2026-06-11"), day("2026-06-12")];
    const pool = [player("a"), player("b"), player("c"), player("d")];
    const result = reshuffleSuggestions(days, pool, TODAY);
    const ids = result.map((d) => d.suggestion!.id);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(pool.some((p) => p.id === id)).toBe(true);
  });

  it("sets suggestion to null when the pool runs out", () => {
    const days = [day("2026-06-10"), day("2026-06-11")];
    const result = reshuffleSuggestions(days, [player("only")], TODAY);
    expect(result[0].suggestion?.id).toBe("only");
    expect(result[1].suggestion).toBeNull();
  });

  it("is deterministic with an injected random source", () => {
    const days = [day("2026-06-10"), day("2026-06-11")];
    const pool = [player("a"), player("b"), player("c")];
    const r1 = reshuffleSuggestions(days, pool, TODAY, () => 0.5);
    const r2 = reshuffleSuggestions(days, pool, TODAY, () => 0.5);
    expect(r1.map((d) => d.suggestion?.id)).toEqual(r2.map((d) => d.suggestion?.id));
  });

  it("does not mutate the input arrays", () => {
    const days = [day("2026-06-10")];
    const pool = [player("a"), player("b")];
    const poolCopy = [...pool];
    reshuffleSuggestions(days, pool, TODAY);
    expect(days[0].suggestion).toBeNull();
    expect(pool).toEqual(poolCopy);
  });
});

describe("reorderList", () => {
  const list = ["a", "b", "c", "d"];

  it("moves an item down the list", () => {
    expect(reorderList(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves an item up the list", () => {
    expect(reorderList(list, 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("returns the input unchanged for no-op or out-of-range moves", () => {
    expect(reorderList(list, 1, 1)).toBe(list);
    expect(reorderList(list, -1, 2)).toBe(list);
    expect(reorderList(list, 0, 4)).toBe(list);
  });

  it("does not mutate the input", () => {
    reorderList(list, 0, 3);
    expect(list).toEqual(["a", "b", "c", "d"]);
  });
});

describe("movePlayerBetweenDays", () => {
  it("swaps two assigned players and emits two upserts", () => {
    const days = [
      day("2026-06-11", player("a")),
      day("2026-06-12", player("b")),
    ];
    const result = movePlayerBetweenDays(days, "2026-06-11", "2026-06-12", TODAY);
    expect(result).not.toBeNull();
    expect(result!.days[0].assignedPlayer?.id).toBe("b");
    expect(result!.days[1].assignedPlayer?.id).toBe("a");
    expect(result!.ops).toEqual([
      { type: "upsert", date: "2026-06-12", playerId: "a" },
      { type: "upsert", date: "2026-06-11", playerId: "b" },
    ]);
  });

  it("moves an assigned player to an open day and backfills the source with the target's suggestion", () => {
    const days = [
      day("2026-06-11", player("a")),
      day("2026-06-12", null, player("s")),
    ];
    const result = movePlayerBetweenDays(days, "2026-06-11", "2026-06-12", TODAY);
    expect(result!.days[0].assignedPlayer).toBeNull();
    expect(result!.days[0].suggestion?.id).toBe("s");
    expect(result!.days[1].assignedPlayer?.id).toBe("a");
    expect(result!.days[1].suggestion).toBeNull();
    expect(result!.ops).toEqual([
      { type: "upsert", date: "2026-06-12", playerId: "a" },
      { type: "delete", date: "2026-06-11" },
    ]);
  });

  it("swaps suggestions locally with no DB writes", () => {
    const days = [
      day("2026-06-11", null, player("s1")),
      day("2026-06-12", null, player("s2")),
    ];
    const result = movePlayerBetweenDays(days, "2026-06-11", "2026-06-12", TODAY);
    expect(result!.days[0].suggestion?.id).toBe("s2");
    expect(result!.days[1].suggestion?.id).toBe("s1");
    expect(result!.ops).toEqual([]);
  });

  it("rejects dropping a suggestion onto an assigned day", () => {
    const days = [
      day("2026-06-11", null, player("s")),
      day("2026-06-12", player("a")),
    ];
    expect(movePlayerBetweenDays(days, "2026-06-11", "2026-06-12", TODAY)).toBeNull();
  });

  it("rejects moves involving today or past days", () => {
    const days = [
      day("2026-06-09", player("past")),
      day("2026-06-10", player("today")),
      day("2026-06-11", player("future")),
    ];
    expect(movePlayerBetweenDays(days, "2026-06-09", "2026-06-11", TODAY)).toBeNull();
    expect(movePlayerBetweenDays(days, "2026-06-10", "2026-06-11", TODAY)).toBeNull();
    expect(movePlayerBetweenDays(days, "2026-06-11", "2026-06-10", TODAY)).toBeNull();
  });

  it("rejects same-day drops, unknown dates, and empty source days", () => {
    const days = [day("2026-06-11", player("a")), day("2026-06-12")];
    expect(movePlayerBetweenDays(days, "2026-06-11", "2026-06-11", TODAY)).toBeNull();
    expect(movePlayerBetweenDays(days, "2026-06-11", "2026-06-20", TODAY)).toBeNull();
    expect(movePlayerBetweenDays(days, "2026-06-12", "2026-06-11", TODAY)).toBeNull();
  });

  it("does not mutate the input days", () => {
    const days = [day("2026-06-11", player("a")), day("2026-06-12", player("b"))];
    movePlayerBetweenDays(days, "2026-06-11", "2026-06-12", TODAY);
    expect(days[0].assignedPlayer?.id).toBe("a");
    expect(days[1].assignedPlayer?.id).toBe("b");
  });
});
