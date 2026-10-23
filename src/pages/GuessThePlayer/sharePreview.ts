// Personalised link previews for shared daily results.
//
// GitHub Pages is static and the app uses a HashRouter, so link unfurlers
// (iMessage, WhatsApp, Slack, X) never see the `#/guess` part or run JS. Each
// possible daily outcome therefore gets its own static page at `r/<code>/`,
// built by the plugin in `vite.config.ts`, carrying OG/Twitter tags for that
// outcome and sending browsers on to `#/guess`.
//
// Pure and DOM-free: `vite.config.ts` imports this under `tsconfig.node.json`.
// Only the outcome goes into a page, never any player data.

import { MAX_ATTEMPTS, SHARE_URL, SITE_BASE, SITE_URL } from "./constants";

/** Every outcome code: solved in 1-5 or failed (`x`), each with `h` for hard mode. */
export const RESULT_CODES = ["1", "2", "3", "4", "5", "x"].flatMap((c) => [c, `${c}h`]);

export interface ResultOutcome {
  won: boolean;
  attempts: number;
  hardMode: boolean;
}

export interface PreviewMeta {
  title: string;
  description: string;
  url: string;
}

/** Same copy as `index.html`, used by the fallback page. */
export const GENERIC_TITLE = "Football Nerdle";
export const GENERIC_DESCRIPTION =
  "Daily football trivia: guess the mystery player from their club history, or battle a friend by naming players who played together.";
const SITE_NAME = "Football Nerdle";
const OG_IMAGE = `${SITE_URL}og-image.png`;
const OG_IMAGE_ALT = "Football Nerdle: daily football trivia";
const CALL_TO_ACTION = "Can you name today's mystery player?";

export function getResultCode({ won, attempts, hardMode }: ResultOutcome): string {
  return `${won ? String(attempts) : "x"}${hardMode ? "h" : ""}`;
}

export function parseResultCode(code: string): ResultOutcome | null {
  if (!RESULT_CODES.includes(code)) return null;
  const hardMode = code.endsWith("h");
  const base = hardMode ? code.slice(0, -1) : code;
  if (base === "x") return { won: false, attempts: MAX_ATTEMPTS, hardMode };
  return { won: true, attempts: Number(base), hardMode };
}

/** The emoji row of the share text: a red per wrong guess, a green for a solve, padded with black. */
export function getResultSquares(won: boolean, attempts: number): string {
  const wrongCount = won ? attempts - 1 : attempts;
  return Array.from({ length: MAX_ATTEMPTS }, (_, i) => {
    if (i < wrongCount) return "🔴";
    return won ? "🟢" : "⬛";
  }).join("");
}

export function getResultShareUrl(code: string): string {
  return `${SITE_URL}r/${code}/`;
}

/**
 * URL line of the share text: the daily points at its result page, the
 * Archive at `#/guess?day=N`, and debug (`?id=`) at plain `#/guess`.
 */
export function getShareUrl({
  isDaily, isArchive, dayNumber, won, attempts, hardMode,
}: ResultOutcome & { isDaily: boolean; isArchive: boolean; dayNumber: number }): string {
  if (isArchive) return `${SHARE_URL}?day=${dayNumber}`;
  if (isDaily) return getResultShareUrl(getResultCode({ won, attempts, hardMode }));
  return SHARE_URL;
}

/** Title, description and own URL of a result page; `null` for an invalid code. */
export function getPreviewMeta(code: string): PreviewMeta | null {
  const outcome = parseResultCode(code);
  if (!outcome) return null;
  const { won, attempts, hardMode } = outcome;
  const title = won
    ? `Football Nerdle: solved in ${attempts}/${MAX_ATTEMPTS}`
    : `Football Nerdle: missed today's player (X/${MAX_ATTEMPTS})`;
  const hintCount = won ? attempts - 1 : attempts;
  const parts = [getResultSquares(won, attempts)];
  if (hardMode) parts.push("Hard mode");
  parts.push(hintCount === 0 ? "No hints" : `${hintCount} hint${hintCount > 1 ? "s" : ""}`);
  return {
    title,
    description: `${parts.join(" · ")}. ${CALL_TO_ACTION}`,
    url: getResultShareUrl(code),
  };
}

export function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPage(meta: PreviewMeta, redirectPath: string, linkText: string): string {
  const e = escapeHtmlAttribute;
  const title = e(meta.title);
  const description = e(meta.description);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="${e(SITE_BASE)}favicon.svg" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="theme-color" content="#0b0f19" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${e(SITE_NAME)}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${e(meta.url)}" />
    <meta property="og:image" content="${e(OG_IMAGE)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${e(OG_IMAGE_ALT)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${e(OG_IMAGE)}" />
  </head>
  <body>
    <script>location.replace(${JSON.stringify(redirectPath)})</script>
    <p><a href="${e(redirectPath)}">${e(linkText)}</a></p>
  </body>
</html>
`;
}

/** Static page for one outcome code; throws on an invalid code (build-time only). */
export function renderResultPage(code: string): string {
  const meta = getPreviewMeta(code);
  if (!meta) throw new Error(`Invalid result code: ${code}`);
  return renderPage(meta, `${SITE_BASE}#/guess`, "Play today's Football Nerdle");
}

/** `404.html`: the generic preview, sending browsers to the home page. */
export function renderFallbackPage(): string {
  return renderPage(
    { title: GENERIC_TITLE, description: GENERIC_DESCRIPTION, url: SITE_URL },
    SITE_BASE,
    "Go to Football Nerdle",
  );
}
