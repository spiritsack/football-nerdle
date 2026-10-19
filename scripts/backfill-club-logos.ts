/**
 * Backfill missing club logos from Wikidata/Wikipedia.
 *
 * For every club with an empty badge, most-used first (by player_clubs rows),
 * looks up its logo (Wikidata P154, else the English Wikipedia article's lead
 * image if it looks like a crest), downloads it into the club-crests bucket
 * and points the badge at our copy.
 * A same-named duplicate club without a badge gets the same crest. A youth or
 * reserve team ("Derby U18") points at its parent club's crest instead, or the
 * parent's Wikipedia logo is saved for both. Anything uncertain (no parent, or
 * several clubs with the parent's name) is listed for checking by hand and
 * never saved.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/backfill-club-logos.ts                  # All clubs missing a badge
 *   npx tsx --env-file=.env scripts/backfill-club-logos.ts --dry-run        # Preview without writing
 *   npx tsx --env-file=.env scripts/backfill-club-logos.ts --club wd_Q9617  # A single club
 *   npx tsx --env-file=.env scripts/backfill-club-logos.ts --limit 50       # The 50 most-used clubs only
 *   npx tsx --env-file=.env scripts/backfill-club-logos.ts --youth-only     # Only youth/reserve teams (no Wikipedia calls when the parent has a badge)
 *
 * Requires:
 *   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (the anon key can only do --dry-run)
 */

import { createClient } from "@supabase/supabase-js";
import { findClubOrParentLogo } from "../src/api/clubLogoLookup";
import type { LogoClub } from "../src/api/clubLogoLookup";
import { saveFoundLogo } from "../src/api/clubCrestStorage";
import { parentClubName } from "../src/pages/Admin/clubLogo";

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
const YOUTH_ONLY = process.argv.includes("--youth-only");

// Wikimedia asks API clients to identify themselves
const HEADERS = { "User-Agent": "football-nerdle/1.0 (https://github.com/spiritsack/football-nerdle)" };
const REQUEST_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** usage_count: how many player_clubs rows point at the club (not fetched for --club) */
type BackfillClub = LogoClub & { usage_count?: number };

async function getClubsMissingBadge(): Promise<BackfillClub[]> {
  if (SINGLE_CLUB) {
    const { data, error } = await supabase.from("clubs").select("id, name, transfermarkt_id, badge").eq("id", SINGLE_CLUB).single();
    if (error || !data) throw new Error(`Club ${SINGLE_CLUB} not found`);
    if (data.badge) console.log(`  Note: ${SINGLE_CLUB} already has a badge (${data.badge})`);
    return [data];
  }

  const clubs: BackfillClub[] = [];
  const pageSize = 1000;
  for (let from = 0; clubs.length < LIMIT; from += pageSize) {
    const { data, error } = await supabase.rpc("get_clubs_without_badge", { p_offset: from, p_limit: pageSize });
    if (error) throw new Error(`Failed to query clubs: ${error.message}`);
    if (!data || data.length === 0) break;
    const page = data as BackfillClub[];
    clubs.push(...(YOUTH_ONLY ? page.filter((c) => parentClubName(c.name)) : page));
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
  let fromParent = 0;
  let saved = 0;
  let othersFilled = 0;

  for (const [i, club] of clubs.entries()) {
    if (filled.has(club.id)) continue;
    const usage = club.usage_count === undefined ? "" : ` (${club.usage_count} spells)`;
    const label = `  [${i + 1}/${clubs.length}] ${club.id} ${club.name}${usage}`;
    let calledWikipedia = true;
    try {
      const logo = await findClubOrParentLogo(supabase, club, HEADERS);
      calledWikipedia = logo.status !== "found" || logo.source !== "parent";
      const parent = logo.parent ? `from parent club ${logo.parent.id} ${logo.parent.name}` : null;
      if (logo.status === "review") {
        const extra = logo.candidates ? ` (${logo.candidates.join(", ")})` : "";
        console.log(`${label} — check by hand: ${logo.reason}${extra}`);
        review.push({ club, reason: logo.reason + extra, link: logo.articleUrl ?? logo.imageUrl });
        continue;
      }
      found++;
      if (logo.parent) fromParent++;
      const via = logo.source === "parent"
        ? `${parent}'s crest`
        : [`${logo.source === "wikidata" ? "Wikidata logo" : "article image"}, matched by ${logo.foundBy}`, parent].filter(Boolean).join(", ");
      if (DRY_RUN) {
        console.log(`${label} — ${logo.file} (${via})`);
        continue;
      }

      const { badge, alsoFilled } = await saveFoundLogo(supabase, club, logo, HEADERS);
      saved++;
      filled.add(club.id);
      alsoFilled.forEach((id) => filled.add(id));
      othersFilled += alsoFilled.length;
      console.log(`${label} — saved ${badge} (${via})${alsoFilled.length ? `, also ${alsoFilled.join(", ")}` : ""}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.log(`${label} — check by hand: ${reason}`);
      review.push({ club, reason, link: null });
    }
    if (calledWikipedia) await sleep(REQUEST_DELAY_MS);
  }

  console.log(`\n=== Check by hand (${review.length}) ===`);
  for (const r of review) {
    console.log(`  ${r.club.id}\t${r.club.name}\t${r.reason}${r.link ? `\t${r.link}` : ""}`);
  }

  console.log(`\n=== Results ===`);
  console.log(`  Clubs looked up: ${clubs.length}`);
  console.log(`  Logos found: ${found} (${fromParent} from a parent club)`);
  console.log(`  Check by hand: ${review.length}`);
  if (!DRY_RUN) {
    console.log(`  Logos saved: ${saved}`);
    console.log(`  Parent and duplicate clubs given the same crest: ${othersFilled}`);
  }
}

main().catch(console.error);
