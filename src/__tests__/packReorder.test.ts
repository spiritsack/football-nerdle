import { describe, it, expect } from "vitest";
import { reorder } from "../pages/Admin/packReorder";

describe("reorder", () => {
  it("moves an item to a later index", () => {
    expect(reorder(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves an item to an earlier index", () => {
    expect(reorder(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("returns the original array reference when from === to", () => {
    const arr = ["a", "b", "c"];
    expect(reorder(arr, 1, 1)).toBe(arr);
  });

  it("returns the original array when indices are out of bounds", () => {
    const arr = ["a", "b", "c"];
    expect(reorder(arr, -1, 0)).toBe(arr);
    expect(reorder(arr, 0, 5)).toBe(arr);
  });

  it("does not mutate the input", () => {
    const arr = ["a", "b", "c"];
    reorder(arr, 0, 2);
    expect(arr).toEqual(["a", "b", "c"]);
  });
});
