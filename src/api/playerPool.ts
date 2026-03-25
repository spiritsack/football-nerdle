import { supabase } from "./supabaseClient";
import { getTeamPlayers } from "./sportsdb";
import { getPlayerWithTeamsCached, getRandomCachedPlayer } from "./playerCache";
import { TOP_CLUBS } from "../data/topClubs";
import { SEED_PLAYERS } from "../data/seedPlayers";
import type { PlayerWithTeams } from "../types";

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function needsRefresh(): Promise<boolean> {
  if (!supabase) return false;
  const today = getTodayDate();
  const { data } = await supabase
    .from("pool_refresh")
    .select("last_refresh")
    .eq("id", "singleton")
    .single();

  return !data || data.last_refresh !== today;
}

async function claimRefresh(): Promise<boolean> {
  if (!supabase) return false;
  const today = getTodayDate();

  // Try to insert — first caller wins
  const { error: insertError } = await supabase
    .from("pool_refresh")
    .upsert({ id: "singleton", last_refresh: today, clubs_refreshed: [] });

  if (insertError) return false;

  // Verify we actually set today (another client might have beaten us)
  const { data } = await supabase
    .from("pool_refresh")
    .select("last_refresh")
    .eq("id", "singleton")
    .single();

  return data?.last_refresh === today;
}

async function refreshClubs(clubIds: string[]): Promise<void> {
  if (!supabase) return;

  for (const clubId of clubIds) {
    try {
      const players = await getTeamPlayers(clubId);
      for (const p of players) {
        // This fetches full team history and caches everything
        await getPlayerWithTeamsCached({
          id: p.id,
          name: p.name,
          thumbnail: p.thumbnail,
          nationality: p.nationality,
        });
      }
      // Small delay between clubs to avoid rate limits
      await new Promise((r) => setTimeout(r, 2000));
    } catch (e) {
      console.warn(`Failed to refresh club ${clubId}:`, e);
    }
  }

  // Record which clubs were refreshed
  await supabase
    .from("pool_refresh")
    .update({ clubs_refreshed: clubIds })
    .eq("id", "singleton");
}

export async function refreshPoolIfNeeded(): Promise<void> {
  try {
    if (!(await needsRefresh())) return;
    if (!(await claimRefresh())) return;

    // Pick 3 random top clubs to refresh today
    const shuffled = [...TOP_CLUBS].sort(() => Math.random() - 0.5);
    const toRefresh = shuffled.slice(0, 3).map((c) => c.id);

    // Run in background — don't block the caller
    refreshClubs(toRefresh);
  } catch {
    // Non-critical — pool refresh failure shouldn't affect gameplay
  }
}

export async function getRandomPoolPlayer(): Promise<PlayerWithTeams> {
  // Try to get a random player from the cached pool
  try {
    const cached = await getRandomCachedPlayer();
    if (cached && cached.formerTeams.length > 0) return cached;
  } catch {
    // Fall through to seed players
  }

  // Fallback to seed players
  const seed = SEED_PLAYERS[Math.floor(Math.random() * SEED_PLAYERS.length)];
  return getPlayerWithTeamsCached(seed);
}
