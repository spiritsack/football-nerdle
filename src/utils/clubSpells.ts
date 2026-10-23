import type { FormerTeam } from "../types";

/** A loan never merges with a permanent spell at the same club (e.g. a loan, then signed): they stay two tiles, as in Admin. Two loans, or two permanent spells, may merge. */
export function canMergeLoanStatus(a: Pick<FormerTeam, "isLoan">, b: Pick<FormerTeam, "isLoan">): boolean {
  return !a.isLoan === !b.isLoan;
}
