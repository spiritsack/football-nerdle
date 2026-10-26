/**
 * Pure rules for creating a club from the Admin "Add a club" form: the id
 * scheme, name validation, and the duplicate check (search terms and ranking).
 */
import { normalizeClubName, stripClubSuffix } from "../../utils/clubNames";

/**
 * Prefix for clubs created in the Admin UI. Imported ids are `tm_<n>`
 * (TransferMarkt), `wd_Q<n>` (Wikidata backfill) and numeric sportsdb ids, so
 * `admin_<uuid>` can't collide with them.
 */
export const CREATED_CLUB_PREFIX = "admin_";

export const MAX_CLUB_NAME_LENGTH = 100;

export function newCreatedClubId(uuid: string = crypto.randomUUID()): string {
  return `${CREATED_CLUB_PREFIX}${uuid}`;
}

/** An error message for an unusable club name, or null when it's fine */
export function validateNewClubName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Enter a club name.";
  if (trimmed.length > MAX_CLUB_NAME_LENGTH) return `Club name must be ${MAX_CLUB_NAME_LENGTH} characters or fewer.`;
  return null;
}

/** "Núñez" → "Nunez" */
export function removeDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Words too common in club names to find a club by */
const COMMON_WORDS = new Set(["fc", "club", "de", "united", "city", "real", "sporting", "athletic"]);

/**
 * Leading club-type words ("Club Nacional", "CR Flamengo", "AS Roma"). They
 * often tell clubs apart ("AC Milan" vs "BK Milan"), so names that only match
 * once one is dropped are "similar", never "same".
 */
const LEADING_PREFIX = /^(club|fc|cf|afc|ac|as|sc|cd|cr|fk|bk|sv)\s+/;

/** Trailing suffixes that never tell clubs apart: "Liverpool FC" is "Liverpool" */
const SAME_NAME_SUFFIX = /\s+(fc|cf|afc)$/;

function tokens(s: string): string[] {
  return s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** Lowercase, accent-free name with trailing FC/AC/... removed */
function strippedName(name: string): string {
  return stripClubSuffix(removeDiacritics(name));
}

/**
 * At most 2 distinctive words of the name to search the clubs table with
 * (longest first). Common words are dropped unless nothing else is left.
 */
export function similarClubSearchTerms(name: string): string[] {
  const stripped = strippedName(name);
  const words = [...new Set(tokens(stripped).filter((w) => w.length >= 3))];
  const distinctive = words.filter((w) => !COMMON_WORDS.has(w));
  const picked = distinctive.length > 0 ? distinctive : words;
  if (picked.length === 0) return stripped ? [stripped] : [];
  return [...picked].sort((a, b) => b.length - a.length).slice(0, 2);
}

export type ClubMatch = "same" | "similar";

export interface RankedClub<T> {
  club: T;
  match: ClubMatch;
}

/** Equal after case, accents, punctuation and whitespace, plus one trailing FC/CF/AFC */
function isSameName(a: string, b: string): boolean {
  const key = (s: string) => normalizeClubName(removeDiacritics(s)).replace(SAME_NAME_SUFFIX, "");
  return key(a) === key(b);
}

/** Every word of the shorter list appears in the longer one */
function isWordSubset(ta: string[], tb: string[]): boolean {
  if (ta.length === 0 || tb.length === 0) return false;
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const longerSet = new Set(longer);
  return shorter.every((t) => longerSet.has(t));
}

/**
 * Whole words only (which also covers one name containing the other), so
 * "Nacional" is not similar to "Internacional". Names that are equal once a
 * leading club-type word is dropped ("AC Milan" vs "BK Milan FC") count too;
 * "AC Milan" vs "Inter Milan" does not.
 */
function isSimilarName(a: string, b: string): boolean {
  const sa = strippedName(a);
  const sb = strippedName(b);
  if (isWordSubset(tokens(sa), tokens(sb))) return true;
  return sa.replace(LEADING_PREFIX, "") === sb.replace(LEADING_PREFIX, "");
}

/** Candidates with the same or a similar name as `name`, "same" first; the rest are dropped */
export function rankSimilarClubs<T extends { name: string }>(name: string, candidates: T[]): RankedClub<T>[] {
  const same: RankedClub<T>[] = [];
  const similar: RankedClub<T>[] = [];
  for (const club of candidates) {
    if (!club.name?.trim()) continue;
    if (isSameName(name, club.name)) same.push({ club, match: "same" });
    else if (isSimilarName(name, club.name)) similar.push({ club, match: "similar" });
  }
  return [...same, ...similar];
}

/** What the create-club panel is doing: `checking` for duplicates, or `creating` the club */
export type Status = "idle" | "checking" | "creating";

/** How the create-club panel closed */
export type CreatePanelOutcome = "created" | "used" | "cancelled";

/**
 * Where focus goes once the panel closes: a picked club (created or existing)
 * fills the search input, so the next step is the "Joined" year; a cancel goes
 * back to the "+ Create new club" button that opened the panel.
 */
export function focusAfterCreatePanel(outcome: CreatePanelOutcome): "joined" | "createButton" {
  return outcome === "cancelled" ? "createButton" : "joined";
}

/** Escape closes the panel, except while the club is being created (Cancel is disabled then too) */
export function closesCreatePanel(key: string, status: Status): boolean {
  return key === "Escape" && status !== "creating";
}
