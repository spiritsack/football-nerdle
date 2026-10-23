import { describe, it, expect } from "vitest";
import { canMergeLoanStatus } from "../utils/clubSpells";

describe("canMergeLoanStatus", () => {
  it("lets two loans merge", () => {
    expect(canMergeLoanStatus({ isLoan: true }, { isLoan: true })).toBe(true);
  });

  it("lets two permanent spells merge", () => {
    expect(canMergeLoanStatus({ isLoan: false }, { isLoan: false })).toBe(true);
    expect(canMergeLoanStatus({}, {})).toBe(true);
  });

  it("treats undefined and false both as permanent", () => {
    expect(canMergeLoanStatus({ isLoan: undefined }, { isLoan: false })).toBe(true);
    expect(canMergeLoanStatus({ isLoan: false }, {})).toBe(true);
  });

  it("keeps a loan and a permanent spell apart, in either order", () => {
    expect(canMergeLoanStatus({ isLoan: true }, { isLoan: false })).toBe(false);
    expect(canMergeLoanStatus({ isLoan: false }, { isLoan: true })).toBe(false);
    expect(canMergeLoanStatus({ isLoan: undefined }, { isLoan: true })).toBe(false);
    expect(canMergeLoanStatus({ isLoan: true }, {})).toBe(false);
  });
});
