/**
 * Auto-clean a player's club history against their English Wikipedia page.
 *
 * Pure module: parses the {{Infobox football biography}} wikitext, turns it
 * into the history we want (loans split their parent club's spell, youth and
 * reserve teams hidden) and diffs that against our player_clubs rows. Anything
 * the rules can't settle becomes a review note instead of a guess.
 */
import { getBaseClubName, normalizeClubName, stripClubSuffix } from "../../utils/clubNames";
import type { AdminClubRow } from "./types";

// --- Infobox parsing ---

export interface YearRange {
  from: number;
  /** null = still there ("2024–") */
  to: number | null;
}

export interface InfoboxSpell {
  /** Display name (link label), e.g. "Chelsea" */
  name: string;
  /** Every name the club goes by on the page: link label and link target */
  names: string[];
  /** Raw years text, for review notes */
  rawYears: string;
  /** null when the years can't be parsed */
  years: YearRange | null;
  loan: boolean;
}

export interface InfoboxCareer {
  youth: InfoboxSpell[];
  senior: InfoboxSpell[];
  /** null when the page has no current club (retired, free agent, coach) */
  currentClub: { name: string; names: string[] } | null;
}

const INFOBOX_START = /\{\{\s*Infobox[ _]football[ _]biography/i;

/** Youth and reserve sides: hidden from the game */
const YOUTH_NAME =
  /(\s(B|II|U-?\d{2}|Yth\.?|Jgd\.?)$)|\b(Primavera|Youth|Academy|Reserves?|Juniors?|Castilla)\b|\bunder[- ]\d{2}\b/i;

export function isYouthName(name: string): boolean {
  return YOUTH_NAME.test(name.trim());
}

/** The text of the first football biography infobox, or null */
export function extractInfobox(wikitext: string): string | null {
  const match = INFOBOX_START.exec(wikitext);
  if (!match) return null;
  let depth = 0;
  for (let i = match.index; i < wikitext.length - 1; i++) {
    if (wikitext.startsWith("{{", i)) {
      depth++;
      i++;
    } else if (wikitext.startsWith("}}", i)) {
      depth--;
      i++;
      if (depth === 0) return wikitext.slice(match.index, i + 1);
    }
  }
  return null;
}

function stripMarkup(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/'{2,}/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&rarr;/g, "→");
}

/** Split the infobox body into its top-level `name = value` params */
export function parseInfoboxParams(infobox: string): Map<string, string> {
  const body = infobox.slice(2, -2);
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === "{{" || two === "[[") {
      depth++;
      i++;
    } else if (two === "}}" || two === "]]") {
      depth--;
      i++;
    } else if (body[i] === "|" && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));

  const params = new Map<string, string>();
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    params.set(part.slice(0, eq).trim().toLowerCase(), part.slice(eq + 1).trim());
  }
  return params;
}

/** "2009–2011" | "2026–" | "2001" | "2013–14" → range; anything else → null */
export function parseYears(raw: string): YearRange | null {
  const text = stripMarkup(raw).replace(/\{\{0\}\}/g, "").replace(/\s/g, "");
  const match = /^(\d{4})(?:([–—-])(\d{2}|\d{4})?)?$/.exec(text);
  if (!match) return null;
  const from = Number(match[1]);
  if (!match[2]) return { from, to: from };
  if (!match[3]) return { from, to: null };
  const to = match[3].length === 2 ? Number(match[1].slice(0, 2) + match[3]) : Number(match[3]);
  return to >= from ? { from, to } : null;
}

/** "→ [[Reggina Calcio|Reggina]] (loan)" → names + loan flag */
export function parseClub(raw: string): { name: string; names: string[]; loan: boolean } | null {
  let text = stripMarkup(raw).trim();
  const loan = /^(\{\{0\}\})?\s*→/.test(text) || /\(\s*loan\s*\)/i.test(text);
  text = text
    .replace(/^(\{\{0\}\})?\s*→\s*/, "")
    .replace(/\(\s*loan\s*\)/gi, "")
    .replace(/\{\{\s*(?:nowrap|nobr|nobold)\s*\|([^{}]*)\}\}/gi, "$1")
    .replace(/\{\{[^{}]*\}\}/g, "");

  const names: string[] = [];
  const label = text
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target: string, display?: string) => {
      names.push(target.replace(/\s*\([^)]*\)\s*$/, "").trim());
      return display ?? target;
    })
    .replace(/\s+/g, " ")
    .trim();
  if (!label) return null;
  return { name: label, names: [...new Set([label, ...names])], loan };
}

export function parseInfobox(wikitext: string): InfoboxCareer | null {
  const infobox = extractInfobox(wikitext);
  if (!infobox) return null;
  const params = parseInfoboxParams(infobox);

  function spells(yearsKey: string, clubsKey: string): InfoboxSpell[] {
    const result: InfoboxSpell[] = [];
    for (let n = 1; n <= 60; n++) {
      const rawClub = params.get(`${clubsKey}${n}`);
      if (rawClub === undefined) continue;
      const club = parseClub(rawClub);
      if (!club) continue;
      const rawYears = stripMarkup(params.get(`${yearsKey}${n}`) ?? "").trim();
      result.push({ ...club, rawYears, years: parseYears(rawYears) });
    }
    return result;
  }

  const youth = spells("youthyears", "youthclubs").map((s) => ({ ...s, loan: false }));
  const senior: InfoboxSpell[] = [];
  // Reserve sides listed under senior clubs (Barcelona B, Bayern II) are youth for our purposes
  for (const spell of spells("years", "clubs")) {
    if (isYouthName(spell.name)) youth.push({ ...spell, loan: false });
    else senior.push(spell);
  }

  let currentClub: InfoboxCareer["currentClub"] = null;
  const rawCurrent = params.get("currentclub");
  // "Dubai United (head coach)" is a coaching job, not a playing spell
  if (rawCurrent && !/\((head )?coach|manager|director|assistant/i.test(rawCurrent)) {
    const club = parseClub(rawCurrent);
    if (club && !/^(free agent|unattached|retired|none|n\/a|-)$/i.test(club.name)) {
      currentClub = { name: club.name, names: club.names };
    }
  }

  return { youth, senior, currentClub };
}

// --- Target history (what our rows should look like) ---

export interface TargetSpell {
  name: string;
  names: string[];
  from: number;
  to: number | null;
  loan: boolean;
  /** Set on parent-club segments created by splitting around a loan */
  splitFrom?: string;
}

function rangeText(from: number | string | null, to: number | string | null): string {
  return `${from || "?"}–${to || "present"}`;
}

function nameKeys(name: string): string[] {
  const plain = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s*\([^)]*\)\s*$/, "");
  const stripped = stripClubSuffix(plain);
  const core = stripped.replace(/^(fc|afc|ac|as|ssc|rsc|sc|sl|cf|cd|ca|sv|vfl|vfb|tsg|rcd|ud|sd|rc|ogc|losc|kv|krc|kaa|psv|sk|fk|nk|bk)\s+/, "");
  return [...new Set([normalizeClubName(plain), stripped, core].filter(Boolean))];
}

function sameClubNames(a: string[], b: string[]): boolean {
  const keys = new Set(a.flatMap(nameKeys));
  return b.flatMap(nameKeys).some((k) => keys.has(k));
}

/**
 * Turn the infobox's senior career into the spells we want, splitting each
 * parent club's spell around the loans listed under it. Inter 2010–2015 with a
 * Juventus loan 2012–2013 becomes Inter 2010–2012, Juventus 2012–2013 (loan),
 * Inter 2013–2015.
 */
export function buildTargetHistory(career: InfoboxCareer): { spells: TargetSpell[]; review: string[] } {
  const review: string[] = [];
  const spells: TargetSpell[] = [];

  const usable = career.senior.filter((s) => {
    if (s.years) return true;
    review.push(`Wikipedia lists ${s.name}${s.loan ? " (loan)" : ""} with years "${s.rawYears || "?"}" that can't be read — check it by hand.`);
    return false;
  });

  let i = 0;
  while (i < usable.length) {
    const spell = usable[i];
    const years = spell.years!;
    if (spell.loan) {
      // A loan with no parent spell above it: keep it as is
      spells.push({ name: spell.name, names: spell.names, from: years.from, to: years.to, loan: true });
      i++;
      continue;
    }

    const loans: InfoboxSpell[] = [];
    let j = i + 1;
    while (j < usable.length && usable[j].loan) loans.push(usable[j++]);
    i = j;

    const parent = { name: spell.name, names: spell.names, loan: false };
    const end = years.to ?? Infinity;
    const inside = loans.filter((l) => l.years!.from >= years.from && (l.years!.to ?? Infinity) <= end);
    for (const l of loans.filter((x) => !inside.includes(x))) {
      review.push(`${l.name} loan (${l.rawYears}) falls outside the ${spell.name} spell (${spell.rawYears}) — check the years by hand.`);
    }
    inside.sort((a, b) => a.years!.from - b.years!.from);
    const overlapping = inside.some((l, k) => k > 0 && l.years!.from < (inside[k - 1].years!.to ?? Infinity));

    if (overlapping) {
      review.push(`Loans from ${spell.name} overlap each other — the ${spell.name} spell was not split.`);
      spells.push({ ...parent, from: years.from, to: years.to });
      for (const l of loans) spells.push({ name: l.name, names: l.names, from: l.years!.from, to: l.years!.to, loan: true });
      continue;
    }

    let cursor = years.from;
    const split = inside.length > 0 ? spell.name : undefined;
    for (const l of inside) {
      if (l.years!.from > cursor) spells.push({ ...parent, from: cursor, to: l.years!.from, splitFrom: split });
      spells.push({ name: l.name, names: l.names, from: l.years!.from, to: l.years!.to, loan: true });
      cursor = Math.max(cursor, l.years!.to ?? cursor);
    }
    if (years.to === null) spells.push({ ...parent, from: cursor, to: null, splitFrom: split });
    else if (years.to > cursor || inside.length === 0) spells.push({ ...parent, from: cursor, to: years.to, splitFrom: split });
    for (const l of loans.filter((x) => !inside.includes(x))) {
      spells.push({ name: l.name, names: l.names, from: l.years!.from, to: l.years!.to, loan: true });
    }
  }

  // A loan made permanent: Everton loan 2013–2014 then Everton 2013–2017 → Everton 2014–2017
  for (const s of spells) {
    if (s.loan) continue;
    const loan = spells.find((l) => l.loan && l.to !== null && l.from <= s.from && l.to > s.from && sameClubNames(l.names, s.names));
    if (loan && (s.to === null || loan.to! < s.to)) s.from = loan.to!;
  }

  for (let k = 1; k < spells.length; k++) {
    const prev = spells[k - 1];
    const cur = spells[k];
    if (!prev.loan && !cur.loan && prev.to !== null && cur.from < prev.to) {
      review.push(`Wikipedia's ${prev.name} (${rangeText(prev.from, prev.to)}) and ${cur.name} (${rangeText(cur.from, cur.to)}) spells overlap — check the years by hand.`);
    }
  }

  return { spells, review };
}

// --- Club matching ---

export interface ClubRef {
  club_id: string;
  club_name: string;
  badge: string;
}

export interface ResolvedClub extends ClubRef {
  /** Every club id with this exact name: the clubs table has duplicates (e.g. two "Manchester United") */
  ids: string[];
}

/**
 * Match an infobox club to one of our clubs: first the clubs already in the
 * player's history, then the extra candidates (a name search of the clubs
 * table). Ambiguous or missing matches return null.
 */
export function resolveClub(names: string[], rows: AdminClubRow[], candidates: ClubRef[] = []): ResolvedClub | null {
  const ownClubs = uniqueClubs(rows.map((r) => ({ club_id: r.club_id, club_name: r.club_name, badge: r.badge })))
    .filter((c) => !isYouthName(c.club_name));
  const exact = new Set(names.map(normalizeClubName));
  const keys = new Set(names.flatMap(nameKeys));

  for (const pool of [ownClubs, uniqueClubs(candidates).filter((c) => !isYouthName(c.club_name))]) {
    // Exact name first, so "Fenerbahçe" beats a duplicate "Fenerbahce" club
    const found = sameNamed(pool.filter((c) => exact.has(normalizeClubName(c.club_name))))
      ?? sameNamed(pool.filter((c) => nameKeys(c.club_name).some((k) => keys.has(k))));
    if (found) return found;
    if (pool.some((c) => nameKeys(c.club_name).some((k) => keys.has(k)))) return null;
  }

  // Loose fallback within the player's own clubs only: "Inter" ↔ "Inter Milan"
  const loose = ownClubs.filter((c) => {
    const theirs = nameKeys(c.club_name);
    return [...keys].some((k) => theirs.some((t) => wordPrefix(k, t) || wordPrefix(t, k)));
  });
  return sameNamed(loose);
}

/** One club, or several clubs with the same name (TransferMarkt id preferred); null when empty or ambiguous */
function sameNamed(hits: ClubRef[]): ResolvedClub | null {
  if (hits.length === 0) return null;
  if (new Set(hits.map((c) => normalizeClubName(c.club_name))).size > 1) return null;
  const main = hits.find((c) => c.club_id.startsWith("tm_")) ?? hits[0];
  return { ...main, ids: hits.map((c) => c.club_id) };
}

function wordPrefix(short: string, long: string): boolean {
  return short.length >= 4 && long.startsWith(`${short} `);
}

function uniqueClubs(clubs: ClubRef[]): ClubRef[] {
  const seen = new Map<string, ClubRef>();
  for (const c of clubs) if (!seen.has(c.club_id)) seen.set(c.club_id, c);
  return [...seen.values()];
}

/** Infobox club names that don't match a club in the player's history (to search the clubs table for) */
export function unresolvedClubNames(career: InfoboxCareer, rows: AdminClubRow[]): string[] {
  const spells = [...career.senior, ...(career.currentClub ? [career.currentClub] : [])];
  const names = spells.filter((s) => !resolveClub(s.names, rows)).map((s) => s.name);
  return [...new Set(names)];
}

// --- Diff ---

export interface ProposedRow {
  /** Row id for existing rows, `new-<n>` for inserts */
  key: string;
  rowId: number | null;
  club_id: string;
  club_name: string;
  badge: string;
  year_joined: string;
  year_departed: string;
  is_loan: boolean;
  is_youth_team: boolean;
  is_hidden: boolean;
}

export type ChangeKind = "update" | "insert" | "reorder";

export interface SuggestedChange {
  id: string;
  kind: ChangeKind;
  /** Existing row for updates, null for inserts and the reorder */
  before: AdminClubRow | null;
  /** Proposed row for updates and inserts, null for the reorder */
  after: ProposedRow | null;
  reasons: string[];
}

export interface CleanupPlan {
  /** Every existing row (with suggested changes applied) plus inserts, in the suggested order */
  proposed: ProposedRow[];
  changes: SuggestedChange[];
  /** Things the rules can't settle: shown to the admin, never written */
  review: string[];
  /** Set when our latest open spell isn't Wikipedia's current club */
  currentClubNote: string | null;
}

interface PlanInput {
  rows: AdminClubRow[];
  career: InfoboxCareer | null;
  /** Extra clubs from the clubs table for names not in the player's history */
  candidates?: ClubRef[];
  currentYear: number;
}

function rowRange(row: AdminClubRow, currentYear: number): { from: number; to: number } | null {
  const joined = Number(row.year_joined) || null;
  const departed = row.year_departed ? Number(row.year_departed) || null : currentYear;
  const from = joined ?? departed;
  const to = departed ?? joined;
  return from && to ? { from, to } : null;
}

function matchScore(row: AdminClubRow, spell: TargetSpell, currentYear: number): number {
  const range = rowRange(row, currentYear);
  if (!range) return 1;
  const to = spell.to ?? currentYear;
  const overlap = Math.min(range.to, to) - Math.max(range.from, spell.from) + 1;
  if (overlap < 1) return 0;
  return overlap * 2
    + (String(spell.from) === row.year_joined ? 3 : 0)
    + ((spell.to === null ? "" : String(spell.to)) === row.year_departed ? 2 : 0)
    + (spell.loan === row.is_loan ? 1 : 0);
}

function toProposed(row: AdminClubRow): ProposedRow {
  return {
    key: String(row.id),
    rowId: row.id,
    club_id: row.club_id,
    club_name: row.club_name,
    badge: row.badge,
    year_joined: row.year_joined,
    year_departed: row.year_departed,
    is_loan: row.is_loan,
    is_youth_team: row.is_youth_team,
    is_hidden: row.is_hidden,
  };
}

export function planCleanup({ rows, career, candidates = [], currentYear }: PlanInput): CleanupPlan {
  if (!career) {
    return {
      proposed: rows.map(toProposed),
      changes: [],
      review: ["The Wikipedia page has no football infobox — check this player by hand."],
      currentClubNote: null,
    };
  }

  const { spells, review } = buildTargetHistory(career);
  const targets = spells.map((spell) => ({ spell, club: resolveClub(spell.names, rows, candidates) }));
  for (const t of targets.filter((x) => !x.club)) {
    review.push(`${t.spell.name} (${rangeText(t.spell.from, t.spell.to)}${t.spell.loan ? ", loan" : ""}) is on Wikipedia but doesn't match a club in our database — add it by hand.`);
  }

  // Pair rows with target spells, best matches first
  const pairs: { row: number; target: number; score: number }[] = [];
  targets.forEach((t, ti) => {
    if (!t.club) return;
    rows.forEach((r, ri) => {
      if (!t.club!.ids.includes(r.club_id)) return;
      const score = matchScore(r, t.spell, currentYear);
      if (score > 0) pairs.push({ row: ri, target: ti, score });
    });
  });
  pairs.sort((a, b) => b.score - a.score || a.target - b.target || a.row - b.row);
  const rowForTarget = new Map<number, number>();
  const targetForRow = new Map<number, number>();
  for (const p of pairs) {
    if (rowForTarget.has(p.target) || targetForRow.has(p.row)) continue;
    rowForTarget.set(p.target, p.row);
    targetForRow.set(p.row, p.target);
  }

  const changes: SuggestedChange[] = [];
  const proposedRows = new Map<number, ProposedRow>();

  // Rows that match a Wikipedia senior spell: fix years and the loan flag
  for (const [ri, ti] of targetForRow) {
    const row = rows[ri];
    const { spell } = targets[ti];
    const after: ProposedRow = {
      ...toProposed(row),
      year_joined: String(spell.from),
      year_departed: spell.to === null ? "" : String(spell.to),
      is_loan: spell.loan,
      is_youth_team: false,
      is_hidden: spell.loan ? false : row.is_hidden,
    };
    proposedRows.set(ri, after);
    const reasons: string[] = [];
    if (after.year_joined !== row.year_joined || after.year_departed !== row.year_departed) {
      reasons.push(`Years ${rangeText(row.year_joined, row.year_departed)} → ${rangeText(after.year_joined, after.year_departed)}`
        + (spell.splitFrom ? " (split around loan)" : ""));
    }
    if (after.is_loan !== row.is_loan) reasons.push(after.is_loan ? "Mark as loan" : "Not a loan");
    if (row.is_youth_team) reasons.push("Senior spell, not a youth team");
    if (after.is_hidden !== row.is_hidden) reasons.push("Show the loan");
    if (reasons.length > 0) changes.push({ id: `update-${row.id}`, kind: "update", before: row, after, reasons });
  }

  // Remaining rows: youth teams get hidden, anything else needs a human
  rows.forEach((row, ri) => {
    if (targetForRow.has(ri)) return;
    const range = rowRange(row, currentYear);
    const youthByName = isYouthName(row.club_name);
    const youthOnWiki = career.youth.some((y) => sameClubNames([getBaseClubName(row.club_name)], y.names)
      && (!y.years || !range || (range.from <= (y.years.to ?? currentYear) && range.to >= y.years.from)));
    if (youthByName || youthOnWiki || row.is_youth_team) {
      const after: ProposedRow = { ...toProposed(row), is_youth_team: true, is_hidden: true };
      proposedRows.set(ri, after);
      if (!row.is_youth_team || !row.is_hidden) {
        changes.push({
          id: `update-${row.id}`,
          kind: "update",
          before: row,
          after,
          reasons: [youthByName ? "Youth/reserve team name" : youthOnWiki ? "Youth club on Wikipedia" : "Hide youth team"],
        });
      }
      return;
    }
    proposedRows.set(ri, toProposed(row));
    review.push(`${row.club_name} (${rangeText(row.year_joined, row.year_departed)}${row.is_loan ? ", loan" : ""}) isn't in the Wikipedia infobox — check it or delete it by hand.`);
  });

  // Spells we don't have yet (mostly the parent club's spell after a loan)
  const inserts = new Map<number, ProposedRow>();
  targets.forEach((t, ti) => {
    if (!t.club || rowForTarget.has(ti)) return;
    const after: ProposedRow = {
      key: `new-${ti}`,
      rowId: null,
      club_id: t.club.club_id,
      club_name: t.club.club_name,
      badge: t.club.badge,
      year_joined: String(t.spell.from),
      year_departed: t.spell.to === null ? "" : String(t.spell.to),
      is_loan: t.spell.loan,
      is_youth_team: false,
      is_hidden: false,
    };
    inserts.set(ti, after);
    changes.push({
      id: `insert-${ti}`,
      kind: "insert",
      before: null,
      after,
      reasons: [t.spell.splitFrom
        ? `${t.spell.splitFrom} spell split around loan`
        : t.spell.loan ? "Loan missing from our history" : "Missing from our history"],
    });
  });

  // Order: youth first, then the Wikipedia order, with unmatched rows slotted in by year
  const youthRows = rows.map((_, ri) => proposedRows.get(ri)!).filter((r) => r.is_youth_team);
  youthRows.sort((a, b) => (Number(a.year_joined) || 0) - (Number(b.year_joined) || 0));
  const senior: ProposedRow[] = [];
  targets.forEach((_, ti) => {
    const ri = rowForTarget.get(ti);
    if (ri !== undefined) senior.push(proposedRows.get(ri)!);
    else if (inserts.has(ti)) senior.push(inserts.get(ti)!);
  });
  rows.forEach((row, ri) => {
    const p = proposedRows.get(ri)!;
    if (targetForRow.has(ri) || p.is_youth_team) return;
    const joined = Number(row.year_joined) || Infinity;
    const at = senior.findIndex((s) => Number(s.year_joined) > joined);
    senior.splice(at < 0 ? senior.length : at, 0, p);
  });
  const proposed = [...youthRows, ...senior];

  // List changes in the order of the suggested history
  const position = new Map(proposed.map((p, k) => [p.key, k]));
  changes.sort((a, b) => position.get(a.after!.key)! - position.get(b.after!.key)!);

  const currentOrder = rows.map((r) => r.id);
  const newOrder = proposed.filter((p) => p.rowId !== null).map((p) => p.rowId!);
  if (currentOrder.some((id, k) => id !== newOrder[k])) {
    changes.push({ id: "reorder", kind: "reorder", before: null, after: null, reasons: ["Reorder to match Wikipedia"] });
  }

  return { proposed, changes, review, currentClubNote: currentClubNote(career, rows, candidates) };
}

function currentClubNote(career: InfoboxCareer, rows: AdminClubRow[], candidates: ClubRef[]): string | null {
  const open = rows
    .filter((r) => !r.year_departed && !r.is_youth_team && !isYouthName(r.club_name))
    .sort((a, b) => (Number(b.year_joined) || 0) - (Number(a.year_joined) || 0))[0];
  if (!career.currentClub) {
    const last = career.senior[career.senior.length - 1];
    const stillThere = last?.years && last.years.to === null;
    return open && !stillThere
      ? `We have ${open.club_name} as the current club, but Wikipedia lists no current club.`
      : null;
  }
  const club = resolveClub(career.currentClub.names, rows, candidates);
  if (!club) return `Wikipedia's current club, ${career.currentClub.name}, doesn't match a club in our database.`;
  if (open && club.ids.includes(open.club_id)) return null;
  return `Current club: we have ${open ? open.club_name : "none"}, Wikipedia says ${club.club_name}.`;
}

/**
 * The final row order after applying the accepted changes. Skipped inserts
 * drop out. When the reorder is skipped, existing rows keep their current
 * relative order and only accepted inserts take their suggested slots.
 */
export function finalOrder(plan: CleanupPlan, current: AdminClubRow[], accepted: Set<string>): ProposedRow[] {
  const kept = plan.proposed.filter((p) => p.rowId !== null || accepted.has(`insert-${p.key.slice(4)}`));
  if (accepted.has("reorder")) return kept;
  const existing = current.map((r) => kept.find((p) => p.rowId === r.id)!);
  let next = 0;
  return kept.map((p) => (p.rowId === null ? p : existing[next++]));
}
