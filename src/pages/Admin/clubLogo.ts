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
