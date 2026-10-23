import { describe, it, expect } from "vitest";
import {
  RESULT_CODES, getResultCode, parseResultCode, getResultSquares, getResultShareUrl, getShareUrl,
  getPreviewMeta, escapeHtmlAttribute, renderResultPage, renderFallbackPage, GENERIC_TITLE, GENERIC_DESCRIPTION,
} from "../pages/GuessThePlayer/sharePreview";

const SITE = "https://spiritsack.github.io/football-nerdle/";
const OG_IMAGE = `${SITE}og-image.png`;

/** Content of `<meta {attr}="{key}" content="...">`, still HTML-escaped. */
function metaContent(html: string, attr: "property" | "name", key: string): string | undefined {
  const re = new RegExp(`<meta ${attr}="${key.replace(/[:.]/g, "\\$&")}" content="([^"]*)" />`);
  return html.match(re)?.[1];
}

function unescape(value: string): string {
  return value.replaceAll("&#39;", "'").replaceAll("&quot;", '"').replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

describe("result codes", () => {
  it("lists the 12 outcomes: solved in 1-5 or failed, with and without hard mode", () => {
    expect(RESULT_CODES).toHaveLength(12);
    expect([...RESULT_CODES].sort()).toEqual(
      ["1", "1h", "2", "2h", "3", "3h", "4", "4h", "5", "5h", "x", "xh"],
    );
  });

  it("builds a code from an outcome", () => {
    expect(getResultCode({ won: true, attempts: 3, hardMode: false })).toBe("3");
    expect(getResultCode({ won: true, attempts: 1, hardMode: true })).toBe("1h");
    expect(getResultCode({ won: false, attempts: 5, hardMode: true })).toBe("xh");
    expect(getResultCode({ won: false, attempts: 5, hardMode: false })).toBe("x");
  });

  it("round-trips every code", () => {
    for (const code of RESULT_CODES) {
      const outcome = parseResultCode(code);
      expect(outcome).not.toBeNull();
      expect(getResultCode(outcome!)).toBe(code);
    }
    expect(parseResultCode("3")).toEqual({ won: true, attempts: 3, hardMode: false });
    expect(parseResultCode("xh")).toEqual({ won: false, attempts: 5, hardMode: true });
  });

  it.each(["6", "0", "3hh", "", "<script>", "X", "3H", "h", "x3", " 3", "3/", "1.0"])(
    "rejects the invalid code %j",
    (code) => {
      expect(parseResultCode(code)).toBeNull();
      expect(getPreviewMeta(code)).toBeNull();
      expect(() => renderResultPage(code)).toThrow();
    },
  );
});

describe("getResultSquares", () => {
  // Same rows as the inline code that built the share text before (a green
  // solve fills the remaining circles green; a loss pads with black).
  it.each([
    [true, 1, "🟢🟢🟢🟢🟢"],
    [true, 2, "🔴🟢🟢🟢🟢"],
    [true, 3, "🔴🔴🟢🟢🟢"],
    [true, 4, "🔴🔴🔴🟢🟢"],
    [true, 5, "🔴🔴🔴🔴🟢"],
    [false, 1, "🔴⬛⬛⬛⬛"],
    [false, 2, "🔴🔴⬛⬛⬛"],
    [false, 3, "🔴🔴🔴⬛⬛"],
    [false, 4, "🔴🔴🔴🔴⬛"],
    [false, 5, "🔴🔴🔴🔴🔴"],
  ])("won=%s attempts=%i gives %s", (won, attempts, row) => {
    expect(getResultSquares(won, attempts)).toBe(row);
  });
});

describe("share URLs", () => {
  it("points a code at its result page", () => {
    expect(getResultShareUrl("3")).toBe(`${SITE}r/3/`);
    expect(getResultShareUrl("xh")).toBe(`${SITE}r/xh/`);
  });

  const base = { won: true, attempts: 3, hardMode: false, dayNumber: 42 };

  it("sends a daily share to its result page", () => {
    expect(getShareUrl({ ...base, isDaily: true, isArchive: false })).toBe(`${SITE}r/3/`);
    expect(getShareUrl({ ...base, won: false, attempts: 5, hardMode: true, isDaily: true, isArchive: false }))
      .toBe(`${SITE}r/xh/`);
  });

  it("keeps the Archive URL with its day number", () => {
    expect(getShareUrl({ ...base, isDaily: false, isArchive: true })).toBe(`${SITE}#/guess?day=42`);
    expect(getShareUrl({ ...base, isDaily: true, isArchive: true })).toBe(`${SITE}#/guess?day=42`);
  });

  it("keeps the plain #/guess URL for debug shares", () => {
    expect(getShareUrl({ ...base, isDaily: false, isArchive: false })).toBe(`${SITE}#/guess`);
  });
});

describe("getPreviewMeta", () => {
  it("describes a normal-mode solve in 3", () => {
    expect(getPreviewMeta("3")).toEqual({
      title: "Football Nerdle: solved in 3/5",
      description: "🔴🔴🟢🟢🟢 · 2 hints. Can you name today's mystery player?",
      url: `${SITE}r/3/`,
    });
  });

  it("describes a hard-mode loss", () => {
    expect(getPreviewMeta("xh")).toEqual({
      title: "Football Nerdle: missed today's player (X/5)",
      description: "🔴🔴🔴🔴🔴 · Hard mode · 5 hints. Can you name today's mystery player?",
      url: `${SITE}r/xh/`,
    });
  });

  it("handles a first-try solve and a single hint", () => {
    expect(getPreviewMeta("1h")?.description).toBe("🟢🟢🟢🟢🟢 · Hard mode · No hints. Can you name today's mystery player?");
    expect(getPreviewMeta("2")?.description).toBe("🔴🟢🟢🟢🟢 · 1 hint. Can you name today's mystery player?");
  });
});

describe("escapeHtmlAttribute", () => {
  it("escapes characters that could break out of an attribute", () => {
    expect(escapeHtmlAttribute(`<a href="x">Tom & Jerry's</a>`))
      .toBe("&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;");
  });
});

describe("renderResultPage", () => {
  it("carries the personalised tags for /r/3/", () => {
    const html = renderResultPage("3");
    const ogTitle = unescape(metaContent(html, "property", "og:title")!);
    const twTitle = unescape(metaContent(html, "name", "twitter:title")!);
    for (const title of [ogTitle, twTitle]) {
      expect(title).toContain("3/5");
      expect(title).toContain("solved");
    }
    expect(unescape(metaContent(html, "property", "og:description")!)).toContain("🔴🔴🟢🟢🟢");
    expect(unescape(metaContent(html, "name", "twitter:description")!)).toContain("🔴🔴🟢🟢🟢");
    expect(metaContent(html, "property", "og:url")).toBe(`${SITE}r/3/`);
    expect(metaContent(html, "property", "og:image")).toBe(OG_IMAGE);
    expect(metaContent(html, "name", "twitter:image")).toBe(OG_IMAGE);
    expect(metaContent(html, "name", "twitter:card")).toBe("summary_large_image");
    expect(html).toContain("<title>Football Nerdle: solved in 3/5</title>");
  });

  it("says missed, X/5 and hard mode for /r/xh/", () => {
    const html = renderResultPage("xh");
    const title = unescape(metaContent(html, "property", "og:title")!);
    expect(title).toContain("X/5");
    expect(title).toContain("missed");
    expect(unescape(metaContent(html, "property", "og:description")!)).toContain("Hard mode");
    expect(metaContent(html, "property", "og:url")).toBe(`${SITE}r/xh/`);
  });

  it("escapes attribute values", () => {
    const html = renderResultPage("3");
    expect(html).toContain("today&#39;s mystery player");
    expect(html).not.toContain("today's mystery player");
  });

  it("redirects browsers to the daily with a script and a no-JS link, but no meta refresh", () => {
    const html = renderResultPage("3h");
    expect(html).toContain(`<script>location.replace("/football-nerdle/#/guess")</script>`);
    expect(html).toContain(`<a href="/football-nerdle/#/guess">`);
    expect(html).not.toMatch(/http-equiv/i);
  });

  it.each(RESULT_CODES)("holds only the outcome, site name and fixed copy for %s (no player data)", (code) => {
    const html = renderResultPage(code);
    const meta = getPreviewMeta(code)!;
    const allowed = new Set([
      meta.title, meta.description, meta.url, "Football Nerdle", OG_IMAGE,
      "Football Nerdle: daily football trivia", "website", "1200", "630", "summary_large_image",
      "#0b0f19", "width=device-width, initial-scale=1.0",
    ]);
    const contents = [...html.matchAll(/content="([^"]*)"/g)].map((m) => unescape(m[1]));
    expect(contents.length).toBeGreaterThan(10);
    for (const value of contents) expect(allowed).toContain(value);

    // Visible text: only the title and the fixed link copy
    const text = html
      .replace(/<head>[\s\S]*<\/head>/, "")
      .replace(/<script>[\s\S]*?<\/script>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    expect(unescape(text)).toBe("Play today's Football Nerdle");
    expect(html.match(/<title>([^<]*)<\/title>/)?.[1]).toBe(escapeHtmlAttribute(meta.title));
    expect(html).not.toMatch(/supabase|tm_\d/i);
  });
});

describe("renderFallbackPage", () => {
  it("carries the generic preview from index.html and redirects to the home page", () => {
    const html = renderFallbackPage();
    expect(GENERIC_TITLE).toBe("Football Nerdle");
    expect(GENERIC_DESCRIPTION).toBe(
      "Daily football trivia: guess the mystery player from their club history, or battle a friend by naming players who played together.",
    );
    expect(metaContent(html, "property", "og:title")).toBe(GENERIC_TITLE);
    expect(metaContent(html, "name", "twitter:title")).toBe(GENERIC_TITLE);
    expect(metaContent(html, "property", "og:description")).toBe(GENERIC_DESCRIPTION);
    expect(metaContent(html, "name", "description")).toBe(GENERIC_DESCRIPTION);
    expect(metaContent(html, "property", "og:url")).toBe(SITE);
    expect(metaContent(html, "property", "og:image")).toBe(OG_IMAGE);
    expect(html).toContain(`<script>location.replace("/football-nerdle/")</script>`);
    expect(html).toContain(`<a href="/football-nerdle/">`);
  });
});
