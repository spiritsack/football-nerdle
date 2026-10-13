/// <reference types="node" />
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION_REL = "supabase/migrations/015_merge_duplicate_clubs.sql";
const MIGRATION_PATH = resolve(__dirname, "../..", MIGRATION_REL);

const raw = existsSync(MIGRATION_PATH) ? readFileSync(MIGRATION_PATH, "utf8") : "";

/** SQL with `--` line comments removed (no string literal in this file contains `--`). */
const sql = raw
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

/** The `VALUES ( ... ) AS v` block that feeds club_merge. */
const valuesMatch = sql.match(/INSERT INTO club_merge[\s\S]*?FROM \(VALUES([\s\S]*?)\)\s*AS v/i);
const valuesBlock = valuesMatch?.[1] ?? "";

const pairs = [...valuesBlock.matchAll(/\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g)].map(
  ([, wd, canon]) => ({ wd, canon }),
);

/** Top-level statements: $$-bodies blanked out, then split on `;`. */
const statements = sql
  .replace(/\$\$[\s\S]*?\$\$/g, "$$$$")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

function indexOfOrFail(needle: RegExp): number {
  const i = sql.search(needle);
  expect(i, `expected to find ${needle}`).toBeGreaterThanOrEqual(0);
  return i;
}

describe("015_merge_duplicate_clubs migration", () => {
  it("migration file exists at supabase/migrations/015_merge_duplicate_clubs.sql", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
    expect(existsSync(resolve(__dirname, "../..", "merge-duplicate-clubs.sql"))).toBe(false);
  });

  it("mapping has 38 unique wd->canonical pairs", () => {
    expect(pairs).toHaveLength(38);
    const wdIds = pairs.map((p) => p.wd);
    expect(new Set(wdIds).size).toBe(38);
    for (const { wd, canon } of pairs) {
      expect(wd.startsWith("wd_")).toBe(true);
      expect(canon.startsWith("wd_")).toBe(false);
      expect(canon).not.toBe(wd);
    }
    // Spot-check the motivating pair.
    expect(pairs).toContainEqual({ wd: "wd_Q15789", canon: "tm_27" });
  });

  it("wd ids appear only in the club_merge VALUES", () => {
    const outside = sql.replace(valuesBlock, "");
    expect(outside).not.toMatch(/'wd_Q\d+'/);
    // No hard-coded id lists anywhere: every step reads the mapping table.
    expect(sql).not.toMatch(/\bIN\s*\(\s*'/i);
    expect(sql).toMatch(/CREATE TEMP TABLE club_merge[\s\S]*?ON COMMIT DROP/i);
    const writes = statements.filter((s) =>
      /^(INSERT INTO player_clubs|DELETE|UPDATE)\b/i.test(s),
    );
    expect(writes).toHaveLength(6);
    for (const stmt of writes) expect(stmt).toMatch(/club_merge/);
  });

  it("ON CONFLICT target matches 013 unique constraint", () => {
    const constraint013 = readFileSync(
      resolve(__dirname, "../..", "supabase/migrations/013_loan_in_unique_constraint.sql"),
      "utf8",
    );
    expect(constraint013).toMatch(/UNIQUE \(player_id, club_id, year_joined, is_loan\)/);

    const conflicts = [...sql.matchAll(/ON CONFLICT\s*\(([^)]*)\)\s*DO NOTHING/gi)].map((m) =>
      m[1].replace(/\s+/g, " ").trim(),
    );
    expect(conflicts).toEqual(["player_id, club_id, year_joined, is_loan"]);
    expect(sql).toMatch(/DISTINCT ON \(pc\.player_id, m\.canon_id, pc\.year_joined, pc\.is_loan\)/);
    expect(sql).toMatch(/ORDER BY[^;]*pc\.id\s*\n\s*ON CONFLICT/);
  });

  it("re-points FK references before deleting clubs", () => {
    const insertPc = indexOfOrFail(/INSERT INTO player_clubs/i);
    const deletePc = indexOfOrFail(/DELETE FROM player_clubs/i);
    const updatePlayers = indexOfOrFail(/UPDATE players\b[\s\S]*?SET current_club_id/i);
    const updatePacks = indexOfOrFail(/UPDATE pack_schedule\b[\s\S]*?SET club_id/i);
    const badge = indexOfOrFail(/UPDATE clubs\b[\s\S]*?SET badge/i);
    const deleteClubs = indexOfOrFail(/DELETE FROM clubs/i);

    expect(insertPc).toBeLessThan(deletePc);
    expect(deletePc).toBeLessThan(deleteClubs);
    expect(updatePlayers).toBeLessThan(deleteClubs);
    expect(updatePacks).toBeLessThan(deleteClubs);
    expect(badge).toBeLessThan(deleteClubs);
  });

  it("wrapped in a transaction and guarded by club existence", () => {
    expect(statements[0]).toMatch(/^BEGIN$/i);
    expect(statements[statements.length - 1]).toMatch(/^COMMIT$/i);
    expect(sql.match(/^\s*BEGIN;/gim)).toHaveLength(1);
    expect(sql.match(/^\s*COMMIT;/gim)).toHaveLength(1);

    // club_merge is filled only with pairs where both clubs exist.
    const fill = statements.find((s) => /^INSERT INTO club_merge/i.test(s)) ?? "";
    expect(fill).toMatch(/JOIN clubs \w+\s+ON \w+\.id\s*=\s*v\.wd_id/i);
    expect(fill).toMatch(/JOIN clubs \w+\s+ON \w+\.id\s*=\s*v\.canon_id/i);

    // Every data write is ON CONFLICT DO NOTHING, a filtered UPDATE, or a DELETE.
    for (const stmt of statements) {
      if (/^INSERT INTO (?!club_merge)/i.test(stmt)) expect(stmt).toMatch(/ON CONFLICT[\s\S]*DO NOTHING/i);
      if (/^UPDATE\b/i.test(stmt)) expect(stmt).toMatch(/\bWHERE\b/i);
      if (/^DELETE\b/i.test(stmt)) expect(stmt).toMatch(/\bWHERE\b/i);
    }
  });

  it("badge carry-over only fills empty canonical badges", () => {
    const badgeUpdate = statements.find((s) => /^UPDATE clubs\b[\s\S]*SET badge/i.test(s)) ?? "";
    expect(badgeUpdate).not.toBe("");
    const [, alias] = badgeUpdate.match(/^UPDATE clubs (\w+)/i) ?? [];
    expect(alias).toBeDefined();
    const where = badgeUpdate.slice(badgeUpdate.search(/\bWHERE\b/i));
    expect(where).toMatch(new RegExp(`${alias}\\.badge\\s*=\\s*''`));
    expect(where).toMatch(/\w+\.badge\s*<>\s*''/);
  });

  it("no top-level verification SELECTs", () => {
    expect(statements.length).toBeGreaterThan(0);
    for (const stmt of statements) expect(stmt).not.toMatch(/^SELECT\b/i);
  });
});
