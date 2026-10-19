/**
 * Pure helpers for finding a club's logo on Wikipedia: how to look the club up
 * from its id, which article a name search should pick, and whether an image
 * is a crest. The network side lives in api/clubLogoLookup.ts.
 */
import { normalizeClubName, stripClubSuffix } from "../../utils/clubNames";

export type ClubLookupKey =
  | { kind: "wikidata"; qid: string }
  | { kind: "transfermarkt"; transfermarktId: string }
  | { kind: "name" };

/** wd_Q123 clubs came from Wikidata, tm_123 from TransferMarkt; sportsdb ids (plain numbers) only have a name */
export function lookupKeyForClub(clubId: string, transfermarktId?: string | null): ClubLookupKey {
  const wd = /^wd_(Q\d+)$/.exec(clubId);
  if (wd) return { kind: "wikidata", qid: wd[1] };
  const tm = /^tm_(\d+)$/.exec(clubId);
  if (tm) return { kind: "transfermarkt", transfermarktId: tm[1] };
  if (transfermarktId) return { kind: "transfermarkt", transfermarktId };
  return { kind: "name" };
}

const PREFIXES = /^(fc|afc|ac|as|sc|sv|cf|cd|fk|nk|sk|ks|bk|if|ud|us|ss|ssc|vfb|vfl|tsv|tsg)\s+/;

/** Loose key for comparing a club name with an article title: no accents, abbreviations or disambiguation */
export function clubNameKey(name: string): string {
  const plain = name
    .replace(/\s*\([^)]*\)\s*$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return stripClubSuffix(plain).replace(PREFIXES, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

/** Same name as the club table sees it */
export function isSameClubName(a: string, b: string): boolean {
  return normalizeClubName(a) === normalizeClubName(b);
}

function idSource(clubId: string): string {
  return /^(tm|wd)_/.exec(clubId)?.[1] ?? "sportsdb";
}

/**
 * One club imported twice (e.g. sportsdb "133612" and "tm_985", both "Manchester
 * United"). Two tm_ clubs with the same name are different TransferMarkt
 * clubs (two "Portuguesa"s), so they never count.
 */
export function isDuplicateClub(a: { id: string; name: string }, b: { id: string; name: string }): boolean {
  return a.id !== b.id && idSource(a.id) !== idSource(b.id) && isSameClubName(a.name, b.name);
}

export interface ArticleCandidate {
  title: string;
  /** Wikipedia's short description, e.g. "Association football club in England" */
  description: string;
  qid: string | null;
}

export type ArticlePick =
  | { kind: "match"; article: ArticleCandidate }
  | { kind: "ambiguous"; candidates: ArticleCandidate[] }
  | { kind: "none" };

const FOOTBALL_CLUB = /\bfootball (club|team)\b|\bsoccer (club|team)\b|\bfutsal club\b/i;

/** A club's own article: "2015–16 Watford F.C. season" is about a football club, but isn't one */
export function isFootballClubArticle(c: ArticleCandidate): boolean {
  return FOOTBALL_CLUB.test(c.description) && !/\bseasons?\b/i.test(`${c.title} ${c.description}`);
}

/**
 * Pick the article for a club from name-search results. Only a single football
 * club article whose title matches the name counts as a match; several, or
 * football clubs with other names, are ambiguous and go to a person.
 */
export function pickArticle(clubName: string, candidates: ArticleCandidate[]): ArticlePick {
  const clubs = candidates.filter(isFootballClubArticle);
  if (clubs.length === 0) return { kind: "none" };
  const key = clubNameKey(clubName);
  const exact = clubs.filter((c) => clubNameKey(c.title) === key);
  if (exact.length === 1) return { kind: "match", article: exact[0] };
  return { kind: "ambiguous", candidates: exact.length > 1 ? exact : clubs };
}

export interface ImageFacts {
  /** File name without the "File:" prefix */
  file: string;
  mime: string;
  description: string;
  categories: string;
}

export type CrestCheck = { ok: true } | { ok: false; reason: string };

const CREST_HINT = /\b(logos?|crests?|badges?|emblems?|escudo|wappen|vereinswappen|coat of arms|insignia)\b/i;
const PHOTO_HINT = /\b(stadium|stadion|stadio|estadio|stade|arena|grounds?|pitch|squad|team photo|players|photographs?|aerial|panorama)\b/i;

/**
 * Whether an image looks like a crest rather than, say, a stadium photo: no
 * photo hint outside the club's own name, and a logo/crest hint in the file
 * name, description or categories. Wikidata's logo (P154) is a logo by
 * definition, so `isWikidataLogo` skips the hint, but it can still be a photo.
 */
export function checkCrestImage(image: ImageFacts, clubName: string, isWikidataLogo = false): CrestCheck {
  if (!image.mime.startsWith("image/")) return { ok: false, reason: `${image.file} is not an image` };
  const nameWords = new Set(normalizeClubName(clubName).split(" "));
  const withoutClubName = (text: string) =>
    text.split(/(\s+)/).filter((w) => !nameWords.has(w.toLowerCase())).join("");
  const text = [image.file, image.description, image.categories].join(" | ").replace(/[_.|]/g, " ");

  if (PHOTO_HINT.test(withoutClubName(text))) {
    return { ok: false, reason: `${image.file} looks like a photo, not a crest` };
  }
  if (!isWikidataLogo && !CREST_HINT.test(text)) {
    return { ok: false, reason: `${image.file} has no logo or crest hint` };
  }
  return { ok: true };
}

/** Storage file extension for a downloaded image */
export function extensionForMime(mime: string): string | null {
  const type = mime.split(";")[0].trim().toLowerCase();
  return { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg", "image/gif": "gif" }[type] ?? null;
}

// TransferMarkt abbreviates youth/reserve teams: "Derby U18", "Lens Yth.", "Malmö FF Jgd.", "Toulouse For.", "Sevilla FC C"
const YOUTH_SUFFIX =
  /\s+-?\s*(U-?\d{2}|Sub-?\d{2}|S\d{2}|Yth\.?|Youth|Yout|You|Y\.?|Jgd\.?|Jugend|Jun\.|J\.|Gio\.|Giovanili|Primavera|For\.?|Fo\.|Formação|Acad\.|Academy|II|III|B|C|2|3|Reserves?|Res\.|Juvenil(?: [AB])?|Juv\.?(?: [AB])?)$/;

/** The parent club's name for a youth or reserve team ("Derby U18" → "Derby"), or null for a first team */
export function parentClubName(name: string): string | null {
  const trimmed = name.trim();
  const match = YOUTH_SUFFIX.exec(trimmed);
  if (!match) return null;
  const base = trimmed.slice(0, match.index).trim();
  return base || null;
}

/** Key for matching a parent name: case, accents and punctuation don't count ("SönderjyskE" = "Sonderjyske") */
export function parentNameKey(name: string): string {
  return normalizeClubName(name.normalize("NFD").replace(/[̀-ͯ]/g, ""))
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * An `ilike` pattern that finds every club whose name could have the same
 * parentNameKey: vowels (the letters that usually carry an accent) and
 * anything that isn't an ASCII letter or digit become `_`, so "Concordia" also
 * finds "Concórdia". Keeping the consonants keeps the result small: at most
 * ~175 rows for any youth team in the data. Filter the rows with pickParentClub.
 */
export function parentNamePattern(name: string): string {
  return [...name.trim()].map((ch) => (/[a-z0-9]/i.test(ch) && !/[aeiouy]/i.test(ch) ? ch : "_")).join("");
}

export interface ParentCandidate {
  id: string;
  name: string;
  badge: string;
}

export type ParentPick =
  | { kind: "match"; parent: ParentCandidate }
  | { kind: "ambiguous"; candidates: ParentCandidate[] }
  /** Another club has the youth team's own name (two TransferMarkt "Red Star U19"), so its parent can't be told apart */
  | { kind: "same-name"; others: ParentCandidate[] }
  | { kind: "none" };

/** wd_ items have the best Wikidata link, then tm_ (TransferMarkt id), then sportsdb (name only) */
const SOURCE_RANK: Record<string, number> = { wd: 0, tm: 1, sportsdb: 2 };

/** Fewest players a youth team must share with a club for that club to count as its parent */
export const MIN_SHARED_PLAYERS = 2;

/** Prefer a copy with a badge, then the one with the best Wikipedia link */
function bestCopy(copies: ParentCandidate[]): ParentCandidate {
  return [...copies].sort((a, b) =>
    Number(!a.badge) - Number(!b.badge) || SOURCE_RANK[idSource(a.id)] - SOURCE_RANK[idSource(b.id)])[0];
}

/** Clubs with the youth team's parent name, and first teams whose name starts with it */
export function parentPool(
  youth: { id: string; name: string },
  candidates: ParentCandidate[],
): { exact: ParentCandidate[]; longer: ParentCandidate[] } {
  const base = parentClubName(youth.name);
  if (!base) return { exact: [], longer: [] };
  const key = parentNameKey(base);
  const others = candidates.filter((c) => c.id !== youth.id);
  return {
    exact: others.filter((c) => parentNameKey(c.name) === key),
    longer: others.filter((c) => !parentClubName(c.name) && parentNameKey(c.name).startsWith(`${key} `)),
  };
}

/**
 * Pick a youth team's parent. TransferMarkt shortens names, so "Newcastle U18"
 * can belong to "Newcastle United" as well as to a club called "Newcastle":
 * the candidates are clubs with the parent's name and first teams whose name
 * starts with it. `sharedPlayers` (club id → players who also played for the
 * youth team) decides: the parent is the one candidate that clearly shares the
 * most. With no shared players, a single club with exactly the parent's name
 * is a match, and so is one club imported from several sources (sportsdb
 * "133612" and "tm_985" "Manchester United"), or same-named clubs with one
 * badge. Anything else is ambiguous, never guessed. `candidates` should also
 * hold clubs with the youth team's own name: another youth team from the same
 * source with that name ("Red Star U19" twice) can't be told apart.
 */
export function pickParentClub(
  youth: { id: string; name: string },
  candidates: ParentCandidate[],
  sharedPlayers: Record<string, number> = {},
): ParentPick {
  const base = parentClubName(youth.name);
  if (!base) return { kind: "none" };
  const ownKey = parentNameKey(youth.name);
  const others = candidates.filter((c) =>
    c.id !== youth.id && idSource(c.id) === idSource(youth.id) && parentNameKey(c.name) === ownKey);
  if (others.length > 0) return { kind: "same-name", others };

  const { exact, longer } = parentPool(youth, candidates);
  const pool = [...exact, ...longer];
  if (pool.length === 0) return { kind: "none" };

  const shared = (c: ParentCandidate) => sharedPlayers[c.id] ?? 0;
  const ranked = pool.filter((c) => shared(c) > 0).sort((a, b) => shared(b) - shared(a));
  if (ranked.length > 0) {
    const [top, next] = ranked;
    if (shared(top) < MIN_SHARED_PLAYERS || (next && shared(next) === shared(top))) {
      return { kind: "ambiguous", candidates: ranked };
    }
    // Copies of the same club from other sources have no player history of their own
    const topKey = parentNameKey(top.name);
    const copies = pool.filter((c) => idSource(c.id) !== idSource(top.id) && parentNameKey(c.name) === topKey);
    return { kind: "match", parent: bestCopy([top, ...copies]) };
  }

  if (longer.length > 0 || exact.length === 0) return { kind: "ambiguous", candidates: pool };
  const sources = new Set(exact.map((c) => idSource(c.id)));
  const badges = new Set(exact.map((c) => c.badge));
  const oneClub = sources.size === exact.length || (badges.size === 1 && !badges.has(""));
  if (!oneClub) return { kind: "ambiguous", candidates: exact };
  return { kind: "match", parent: bestCopy(exact) };
}
