import { describe, it, expect } from "vitest";
import { reshuffleSuggestions } from "../pages/Admin/helpers";
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
