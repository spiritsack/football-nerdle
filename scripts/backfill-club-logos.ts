/**
 * Backfill missing club logos from Wikidata/Wikipedia.
 *
 * For every club with an empty badge, looks up its logo (Wikidata P154, else
 * the English Wikipedia article's lead image if it looks like a crest),
 * downloads it into the club-crests bucket and points the badge at our copy.
 * A same-named duplicate club without a badge gets the same crest. Anything
 * uncertain is listed for checking by hand and never saved.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/backfill-club-logos.ts                  # All clubs missing a badge
 *   npx tsx --env-file=.env scripts/backfill-club-logos.ts --dry-run        # Preview without writing
 *   npx tsx --env-file=.env scripts/backfill-club-logos.ts --club wd_Q9617  # A single club
 *   npx tsx --env-file=.env scripts/backfill-club-logos.ts --limit 50       # The first 50 clubs only
 *
 * Requires:
 *   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (the anon key can only do --dry-run)
 */

import { createClient } from "@supabase/supabase-js";
import { downloadLogo, findClubLogo } from "../src/api/clubLogoLookup";
import type { LogoClub } from "../src/api/clubLogoLookup";
import { findDuplicateClubsWithoutBadge, shareClubCrest, storeClubCrest } from "../src/api/clubCrestStorage";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

const DRY_RUN = process.argv.includes("--dry-run");
const SINGLE_CLUB = argValue("--club");
const LIMIT = argValue("--limit") ? Number(argValue("--limit")) : Infinity;

// Wikimedia asks API clients to identify themselves
const HEADERS = { "User-Agent": "football-nerdle/1.0 (https://github.com/spiritsack/football-nerdle)" };
const REQUEST_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getClubsMissingBadge(): Promise<LogoClub[]> {
  if (SINGLE_CLUB) {
    const { data, error } = await supabase.from("clubs").select("id, name, transfermarkt_id, badge").eq("id", SINGLE_CLUB).single();
    if (error || !data) throw new Error(`Club ${SINGLE_CLUB} not found`);
    if (data.badge) console.log(`  Note: ${SINGLE_CLUB} already has a badge (${data.badge})`);
    return [data];
  }

  const clubs: LogoClub[] = [];
  const pageSize = 1000;
  for (let from = 0; clubs.length < LIMIT; from += pageSize) {
    const { data, error } = await supabase
      .from("clubs")
      .select("id, name, transfermarkt_id")
      .eq("badge", "")
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Failed to query clubs: ${error.message}`);
    if (!data || data.length === 0) break;
    clubs.push(...data);
    if (data.length < pageSize) break;
  }
  return clubs.slice(0, LIMIT);
}

async function main() {
  console.log("=== Club Logo Backfill ===\n");
  if (DRY_RUN) console.log("DRY RUN — no data will be written\n");

  console.log("Step 1: Finding clubs without a badge...");
  const clubs = await getClubsMissingBadge();
  console.log(`  Found ${clubs.length} clubs\n`);
  if (clubs.length === 0) {
    console.log("Nothing to do!");
    return;
  }

  console.log("Step 2: Looking up logos on Wikidata/Wikipedia...");
  const filled = new Set<string>();
  const review: { club: LogoClub; reason: string; link: string | null }[] = [];
  let found = 0;
  let saved = 0;
  let duplicatesFilled = 0;

  for (const [i, club] of clubs.entries()) {
    if (filled.has(club.id)) continue;
    const label = `  [${i + 1}/${clubs.length}] ${club.id} ${club.name}`;
    try {
      const logo = await findClubLogo(club, HEADERS);
      if (logo.status === "review") {
        const extra = logo.candidates ? ` (${logo.candidates.join(", ")})` : "";
        console.log(`${label} — check by hand: ${logo.reason}${extra}`);
        review.push({ club, reason: logo.reason + extra, link: logo.articleUrl ?? logo.imageUrl });
        continue;
      }
      found++;
      const via = `${logo.source === "wikidata" ? "Wikidata logo" : "article image"}, matched by ${logo.foundBy}`;
      if (DRY_RUN) {
        console.log(`${label} — ${logo.file} (${via})`);
        continue;
      }

      const { blob, ext } = await downloadLogo(logo.imageUrl, HEADERS);
      const badge = await storeClubCrest(supabase, club.id, blob, ext);
      if (!badge) throw new Error("upload failed");
      saved++;
      filled.add(club.id);
      const shared = await shareClubCrest(supabase, await findDuplicateClubsWithoutBadge(supabase, club.id, club.name), badge);
      shared.forEach((id) => filled.add(id));
      duplicatesFilled += shared.length;
      console.log(`${label} — saved ${logo.file} (${via})${shared.length ? `, also ${shared.join(", ")}` : ""}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.log(`${label} — check by hand: ${reason}`);
      review.push({ club, reason, link: null });
    }
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`\n=== Check by hand (${review.length}) ===`);
  for (const r of review) {
    console.log(`  ${r.club.id}\t${r.club.name}\t${r.reason}${r.link ? `\t${r.link}` : ""}`);
  }

  console.log(`\n=== Results ===`);
  console.log(`  Clubs looked up: ${clubs.length}`);
  console.log(`  Logos found: ${found}`);
  console.log(`  Check by hand: ${review.length}`);
  if (!DRY_RUN) {
    console.log(`  Logos saved: ${saved}`);
    console.log(`  Duplicate clubs given the same crest: ${duplicatesFilled}`);
  }
}

main().catch(console.error);
