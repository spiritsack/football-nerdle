/**
 * Find and fetch a player's English Wikipedia page from the browser. Both the
 * Wikidata and Wikipedia APIs allow anonymous CORS requests with origin=*.
 */

export const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
export const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";

export interface WikipediaPage {
  title: string;
  url: string;
  wikitext: string;
  /** "transfermarkt": via the Wikidata item with this TransferMarkt ID (P2446); "name": a name search, which can pick the wrong person */
  foundBy: "transfermarkt" | "name";
}

/** `headers` is for Node scripts, which must send a User-Agent; browsers send their own */
export async function getJson(base: string, params: Record<string, string>, headers?: HeadersInit): Promise<unknown> {
  const query = new URLSearchParams({ ...params, format: "json", formatversion: "2", origin: "*" });
  const res = await fetch(`${base}?${query}`, { headers });
  if (!res.ok) throw new Error(`${new URL(base).hostname} returned ${res.status}`);
  return res.json();
}

async function titleFromTransfermarktId(transfermarktId: string): Promise<string | null> {
  const search = await getJson(WIKIDATA_API, {
    action: "query",
    list: "search",
    srsearch: `haswbstatement:P2446=${transfermarktId}`,
    srlimit: "1",
  }) as { query?: { search?: { title: string }[] } };
  const qid = search.query?.search?.[0]?.title;
  if (!qid) return null;

  const entity = await getJson(WIKIDATA_API, {
    action: "wbgetentities",
    ids: qid,
    props: "sitelinks",
    sitefilter: "enwiki",
  }) as { entities?: Record<string, { sitelinks?: { enwiki?: { title: string } } }> };
  return entity.entities?.[qid]?.sitelinks?.enwiki?.title ?? null;
}

async function titleFromName(name: string): Promise<string | null> {
  const search = await getJson(WIKIPEDIA_API, {
    action: "query",
    list: "search",
    srsearch: `${name} footballer`,
    srlimit: "1",
  }) as { query?: { search?: { title: string }[] } };
  return search.query?.search?.[0]?.title ?? null;
}

async function fetchWikitext(title: string): Promise<{ title: string; wikitext: string } | null> {
  const data = await getJson(WIKIPEDIA_API, {
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    redirects: "1",
    titles: title,
  }) as { query?: { pages?: { title: string; missing?: boolean; revisions?: { slots: { main: { content: string } } }[] }[] } };
  const page = data.query?.pages?.[0];
  const wikitext = page?.revisions?.[0]?.slots.main.content;
  return page && wikitext ? { title: page.title, wikitext } : null;
}

/** null when no English Wikipedia page can be found */
export async function fetchPlayerWikipediaPage(
  transfermarktId: string | null,
  playerName: string,
): Promise<WikipediaPage | null> {
  let title = transfermarktId ? await titleFromTransfermarktId(transfermarktId) : null;
  const foundBy = title ? "transfermarkt" : "name";
  title ??= await titleFromName(playerName);
  if (!title) return null;

  const page = await fetchWikitext(title);
  if (!page) return null;
  return {
    ...page,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    foundBy,
  };
}
