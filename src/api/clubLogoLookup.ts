/**
 * Find a club's logo on Wikidata/Wikipedia and download it. Used by the Admin
 * UI and by scripts/backfill-club-logos.ts, so it must not import the browser
 * Supabase client. Wikimedia's APIs and upload/thumb servers all send
 * Access-Control-Allow-Origin: *, so the browser can fetch the image bytes too.
 */
import { WIKIDATA_API, WIKIPEDIA_API, getJson } from "./wikipedia";
import { checkCrestImage, extensionForMime, lookupKeyForClub, pickArticle } from "../pages/Admin/clubLogo";
import type { ArticleCandidate, ImageFacts } from "../pages/Admin/clubLogo";

export interface LogoClub {
  id: string;
  name: string;
  transfermarkt_id?: string | null;
}

/** How the club was matched to Wikidata/Wikipedia */
export type LogoFoundBy = "wikidata-id" | "transfermarkt" | "name";

interface LogoBase {
  /** PNG thumbnail (SVGs rasterised by Wikimedia) or the original file */
  imageUrl: string | null;
  file: string | null;
  articleTitle: string | null;
  articleUrl: string | null;
}

export interface FoundLogo extends LogoBase {
  status: "found";
  imageUrl: string;
  file: string;
  foundBy: LogoFoundBy;
  /** "wikidata": the item's logo (P154); "article": the article's lead image */
  source: "wikidata" | "article";
}

/** Needs a person: never saved automatically */
export interface ReviewLogo extends LogoBase {
  status: "review";
  reason: string;
  candidates?: string[];
}

export type LogoLookup = FoundLogo | ReviewLogo;

const THUMB_WIDTH = "256";

function articleUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

function stripTracking(url: string): string {
  const u = new URL(url);
  u.search = "";
  return u.toString();
}

async function qidFromTransfermarkt(tmClubId: string, headers?: HeadersInit): Promise<string | null> {
  const data = await getJson(WIKIDATA_API, {
    action: "query",
    list: "search",
    srsearch: `haswbstatement:P7223=${tmClubId}`,
    srlimit: "2",
  }, headers) as { query?: { search?: { title: string }[] } };
  const hits = data.query?.search ?? [];
  return hits.length === 1 ? hits[0].title : null;
}

async function wikidataItem(qid: string, headers?: HeadersInit): Promise<{ logo: string | null; enwiki: string | null }> {
  const data = await getJson(WIKIDATA_API, {
    action: "wbgetentities",
    ids: qid,
    props: "claims|sitelinks",
    sitefilter: "enwiki",
  }, headers) as { entities?: Record<string, {
    claims?: { P154?: { mainsnak: { datavalue?: { value: string } } }[] };
    sitelinks?: { enwiki?: { title: string } };
  }> };
  const entity = data.entities?.[qid];
  return {
    logo: entity?.claims?.P154?.[0]?.mainsnak.datavalue?.value ?? null,
    enwiki: entity?.sitelinks?.enwiki?.title ?? null,
  };
}

async function searchArticles(name: string, headers?: HeadersInit): Promise<ArticleCandidate[]> {
  const data = await getJson(WIKIPEDIA_API, {
    action: "query",
    generator: "search",
    gsrsearch: `${name} football club`,
    gsrlimit: "6",
    prop: "pageprops",
    ppprop: "wikibase-shortdesc|wikibase_item|disambiguation",
    redirects: "1",
  }, headers) as { query?: { pages?: { title: string; index: number; pageprops?: Record<string, string> }[] } };
  return (data.query?.pages ?? [])
    .filter((p) => p.pageprops && !("disambiguation" in p.pageprops))
    .sort((a, b) => a.index - b.index)
    .map((p) => ({
      title: p.title,
      description: p.pageprops?.["wikibase-shortdesc"] ?? "",
      qid: p.pageprops?.wikibase_item ?? null,
    }));
}

/** The article's lead image, including non-free crests (pageimages' `original` only returns free images) */
async function articleImage(title: string, headers?: HeadersInit): Promise<{ title: string; file: string | null } | null> {
  const data = await getJson(WIKIPEDIA_API, {
    action: "query",
    titles: title,
    prop: "pageprops",
    ppprop: "page_image",
    redirects: "1",
  }, headers) as { query?: { pages?: { title: string; missing?: boolean; pageprops?: { page_image?: string } }[] } };
  const page = data.query?.pages?.[0];
  if (!page || page.missing) return null;
  return { title: page.title, file: page.pageprops?.page_image ?? null };
}

interface ImageInfo extends ImageFacts {
  url: string;
}

async function imageInfo(file: string, headers?: HeadersInit): Promise<ImageInfo | null> {
  // en.wikipedia resolves both its own (non-free) files and Commons files
  const data = await getJson(WIKIPEDIA_API, {
    action: "query",
    titles: `File:${file}`,
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiextmetadatafilter: "ImageDescription|Categories",
    iiurlwidth: THUMB_WIDTH,
  }, headers) as { query?: { pages?: { imageinfo?: {
    url: string; thumburl?: string; mime: string;
    extmetadata?: { ImageDescription?: { value: string }; Categories?: { value: string } };
  }[] }[] } };
  const info = data.query?.pages?.[0]?.imageinfo?.[0];
  if (!info) return null;
  return {
    file: file.replace(/_/g, " "),
    url: stripTracking(info.thumburl ?? info.url),
    mime: info.mime,
    // Commons descriptions are HTML
    description: (info.extmetadata?.ImageDescription?.value ?? "").replace(/<[^>]+>/g, ""),
    categories: info.extmetadata?.Categories?.value ?? "",
  };
}

/**
 * Look up a club's logo: the Wikidata item via its id (wd_ clubs, or the
 * TransferMarkt club id P7223), else a name search for a football club
 * article. Wikidata's logo (P154) wins; otherwise the article's lead image,
 * if it looks like a crest. Throws on network errors.
 */
export async function findClubLogo(club: LogoClub, headers?: HeadersInit): Promise<LogoLookup> {
  const key = lookupKeyForClub(club.id, club.transfermarkt_id);
  let qid = key.kind === "wikidata" ? key.qid : null;
  let foundBy: LogoFoundBy = "wikidata-id";
  if (key.kind === "transfermarkt") {
    qid = await qidFromTransfermarkt(key.transfermarktId, headers);
    foundBy = "transfermarkt";
  }

  let title: string | null = null;
  let logo: string | null = null;
  if (qid) {
    ({ logo, enwiki: title } = await wikidataItem(qid, headers));
  } else {
    foundBy = "name";
    const pick = pickArticle(club.name, await searchArticles(club.name, headers));
    if (pick.kind === "none") {
      return review(`No English Wikipedia article for a football club named "${club.name}"`);
    }
    if (pick.kind === "ambiguous") {
      const reason = pick.candidates.length === 1
        ? `The closest article's name doesn't match "${club.name}"`
        : `Several possible articles for "${club.name}"`;
      return { ...review(reason), candidates: pick.candidates.map((c) => c.title) };
    }
    title = pick.article.title;
    if (pick.article.qid) logo = (await wikidataItem(pick.article.qid, headers)).logo;
  }
  const link = title ? { articleTitle: title, articleUrl: articleUrl(title) } : {};

  // A Wikidata logo that fails the photo check is kept for the review list, in case the article has nothing better
  let rejected: ReviewLogo | null = null;
  if (logo) {
    const info = await imageInfo(logo, headers);
    const crest = info && checkCrestImage(info, club.name, true);
    if (info && crest?.ok) return { status: "found", imageUrl: info.url, file: info.file, foundBy, source: "wikidata", articleTitle: null, articleUrl: null, ...link };
    if (info && crest && !crest.ok) rejected = review(`Wikidata logo: ${crest.reason}`, { ...link, imageUrl: info.url, file: info.file });
  }

  if (!title) return rejected ?? review("No English Wikipedia article and no logo on Wikidata");
  const page = await articleImage(title, headers);
  if (!page) return rejected ?? review(`Wikipedia article "${title}" not found`, link);
  const pageLink = { articleTitle: page.title, articleUrl: articleUrl(page.title) };
  if (!page.file) return rejected ?? review("The article has no image", pageLink);

  const info = await imageInfo(page.file, headers);
  if (!info) return rejected ?? review(`Image ${page.file} not found`, pageLink);
  const crest = checkCrestImage(info, club.name);
  if (!crest.ok) return rejected ?? review(crest.reason, { ...pageLink, imageUrl: info.url, file: info.file });
  return { status: "found", imageUrl: info.url, file: info.file, foundBy, source: "article", ...pageLink };
}

function review(reason: string, extra: Partial<LogoBase> = {}): ReviewLogo {
  return { status: "review", reason, imageUrl: null, file: null, articleTitle: null, articleUrl: null, ...extra };
}

/** Download a found logo. Throws when the download fails or isn't an image we can store. */
export async function downloadLogo(imageUrl: string, headers?: HeadersInit): Promise<{ blob: Blob; ext: string }> {
  const res = await fetch(imageUrl, { headers });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const ext = extensionForMime(blob.type || res.headers.get("content-type") || "");
  if (!ext || blob.size === 0) throw new Error(`Download is not an image (${blob.type || "unknown type"})`);
  return { blob, ext };
}
