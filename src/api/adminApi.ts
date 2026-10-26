import { supabase } from "./supabaseClient";
import type { Player } from "../types";
import type { AdminClubRow } from "../pages/Admin/types";
import { finalOrder } from "../pages/Admin/clubHistoryCleanup";
import type { CleanupPlan, ProposedRow } from "../pages/Admin/clubHistoryCleanup";
import { saveFoundLogo, storeClubCrest } from "./clubCrestStorage";
import { findClubOrParentLogo } from "./clubLogoLookup";
import type { LogoClub, LogoLookup } from "./clubLogoLookup";
import { newCreatedClubId, rankSimilarClubs, similarClubSearchTerms } from "../pages/Admin/createClub";
import type { RankedClub } from "../pages/Admin/createClub";

// --- Player lookup ---

export async function getPlayersByIds(
  playerIds: string[],
): Promise<Map<string, Player>> {
  if (!supabase || playerIds.length === 0) return new Map();
  const { data } = await supabase
    .from("players")
    .select("id, name, thumbnail, nationality_id, countries(name)")
    .in("id", playerIds);
  if (!data) return new Map();
  return new Map((data as unknown as Array<{
    id: string; name: string; thumbnail: string; nationality_id: string;
    countries: { name: string } | null;
  }>).map((r) => [r.id, {
    id: r.id,
    name: r.name,
    thumbnail: r.thumbnail || "",
    nationality: r.countries?.name ?? r.nationality_id ?? "",
  }]));
}

export async function getPlayerThumbnails(
  playerIds: string[],
): Promise<Map<string, string>> {
  if (!supabase || playerIds.length === 0) return new Map();
  const { data } = await supabase
    .from("players")
    .select("id, thumbnail")
    .in("id", playerIds);
  return new Map((data ?? []).map((r: { id: string; thumbnail: string }) => [r.id, r.thumbnail]));
}

// --- Schedule operations ---

export async function upsertSchedule(date: string, playerId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("daily_schedule")
    .upsert({ date, player_id: playerId }, { onConflict: "date" });
  if (error) console.error("upsertSchedule failed:", error);
  return !error;
}

export async function deleteSchedule(date: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("daily_schedule")
    .delete()
    .eq("date", date);
  if (error) console.error("deleteSchedule failed:", error);
  return !error;
}

export async function getScheduleRange(
  fromDate: string,
  toDate: string,
): Promise<{ date: string; player_id: string }[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("daily_schedule")
    .select("date, player_id")
    .gte("date", fromDate)
    .lte("date", toDate)
    .order("date");
  return data ?? [];
}

// --- Player field operations ---

export async function getPlayerLegacyStatus(playerId: string): Promise<boolean | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("players")
    .select("is_legacy")
    .eq("id", playerId)
    .single();
  return data?.is_legacy ?? null;
}

export async function updatePlayerLegacy(
  playerId: string,
  isLegacy: boolean | null,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("players")
    .update({ is_legacy: isLegacy })
    .eq("id", playerId);
  if (error) console.error("updatePlayerLegacy failed:", error);
  return !error;
}

// --- Club history operations ---

export async function getPlayerClubsAdmin(playerId: string): Promise<AdminClubRow[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("player_clubs")
    .select("id, club_id, year_joined, year_departed, is_hidden, is_youth_team, is_loan, sort_order, clubs(name, badge)")
    .eq("player_id", playerId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("year_joined", { ascending: true });
  if (!data) return [];
  return (data as unknown as Array<{
    id: number;
    club_id: string;
    year_joined: string;
    year_departed: string;
    is_hidden: boolean;
    is_youth_team: boolean;
    is_loan: boolean;
    sort_order: number | null;
    clubs: { name: string; badge: string } | null;
  }>).map((row) => ({
    id: row.id,
    club_id: row.club_id,
    club_name: row.clubs?.name ?? row.club_id,
    badge: row.clubs?.badge ?? "",
    year_joined: row.year_joined,
    year_departed: row.year_departed,
    is_hidden: row.is_hidden,
    is_youth_team: row.is_youth_team,
    is_loan: row.is_loan,
    sort_order: row.sort_order,
  }));
}

export async function updatePlayerClubHidden(
  playerClubId: number,
  isHidden: boolean,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("player_clubs")
    .update({ is_hidden: isHidden })
    .eq("id", playerClubId);
  if (error) console.error("updatePlayerClubHidden failed:", error);
  return !error;
}

export async function updatePlayerClubYouthTeam(
  playerClubId: number,
  isYouthTeam: boolean,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("player_clubs")
    .update({ is_youth_team: isYouthTeam })
    .eq("id", playerClubId);
  if (error) console.error("updatePlayerClubYouthTeam failed:", error);
  return !error;
}

export async function updatePlayerClubLoan(
  playerClubId: number,
  isLoan: boolean,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("player_clubs")
    .update({ is_loan: isLoan })
    .eq("id", playerClubId);
  if (error) console.error("updatePlayerClubLoan failed:", error);
  return !error;
}

export async function deletePlayerClub(playerClubId: number): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("player_clubs")
    .delete()
    .eq("id", playerClubId);
  if (error) console.error("deletePlayerClub failed:", error);
  return !error;
}

export async function updatePlayerClubYears(
  playerClubId: number,
  yearJoined: string,
  yearDeparted: string,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("player_clubs")
    .update({ year_joined: yearJoined, year_departed: yearDeparted })
    .eq("id", playerClubId);
  if (error) console.error("updatePlayerClubYears failed:", error);
  return !error;
}

export async function addPlayerClub(
  playerId: string,
  clubId: string,
  yearJoined: string,
  yearDeparted: string,
  isLoan = false,
): Promise<AdminClubRow | null> {
  if (!supabase) return null;

  const { data: existing } = await supabase
    .from("player_clubs")
    .select("id, sort_order, year_joined")
    .eq("player_id", playerId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("year_joined", { ascending: true });

  const rows = existing ?? [];
  const hasNulls = rows.some((r) => r.sort_order == null);
  if (hasNulls) {
    for (let i = 0; i < rows.length; i++) {
      await supabase
        .from("player_clubs")
        .update({ sort_order: i })
        .eq("id", rows[i].id);
    }
  }
  const nextSortOrder = rows.length;

  const { data, error } = await supabase
    .from("player_clubs")
    .insert({
      player_id: playerId,
      club_id: clubId,
      year_joined: yearJoined,
      year_departed: yearDeparted,
      is_loan: isLoan,
      sort_order: nextSortOrder,
    })
    .select("id, club_id, year_joined, year_departed, is_hidden, is_youth_team, is_loan, sort_order, clubs(name, badge)")
    .single();
  if (error || !data) {
    console.error("addPlayerClub failed:", error);
    return null;
  }

  const row = data as unknown as {
    id: number;
    club_id: string;
    year_joined: string;
    year_departed: string;
    is_hidden: boolean;
    is_youth_team: boolean;
    is_loan: boolean;
    sort_order: number | null;
    clubs: { name: string; badge: string } | null;
  };
  return {
    id: row.id,
    club_id: row.club_id,
    club_name: row.clubs?.name ?? row.club_id,
    badge: row.clubs?.badge ?? "",
    year_joined: row.year_joined,
    year_departed: row.year_departed,
    is_hidden: row.is_hidden,
    is_youth_team: row.is_youth_team,
    is_loan: row.is_loan,
    sort_order: row.sort_order,
  };
}

// --- Auto-clean operations ---

export async function getPlayerNameAndTransfermarktId(
  playerId: string,
): Promise<{ name: string; transfermarktId: string | null } | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("players")
    .select("name, transfermarkt_id")
    .eq("id", playerId)
    .single();
  return data ? { name: data.name, transfermarktId: data.transfermarkt_id ?? null } : null;
}

type ClubSpellFields = Pick<ProposedRow, "year_joined" | "year_departed" | "is_loan" | "is_youth_team" | "is_hidden">;

function spellFields(row: ProposedRow): ClubSpellFields {
  const { year_joined, year_departed, is_loan, is_youth_team, is_hidden } = row;
  return { year_joined, year_departed, is_loan, is_youth_team, is_hidden };
}

/**
 * Write the accepted auto-clean changes: updates first, then inserts (the
 * spells a loan split off), then the sort order. Returns how many writes failed.
 */
export async function applyClubCleanup(
  playerId: string,
  plan: CleanupPlan,
  current: AdminClubRow[],
  accepted: Set<string>,
): Promise<{ failed: number }> {
  if (!supabase) return { failed: accepted.size };
  let failed = 0;
  const insertedIds = new Map<string, number>();

  for (const change of plan.changes) {
    if (change.kind !== "update" || !accepted.has(change.id)) continue;
    const { error } = await supabase
      .from("player_clubs")
      .update(spellFields(change.after!))
      .eq("id", change.before!.id);
    if (error) {
      console.error("applyClubCleanup update failed:", error);
      failed++;
    }
  }

  for (const change of plan.changes) {
    if (change.kind !== "insert" || !accepted.has(change.id)) continue;
    const { data, error } = await supabase
      .from("player_clubs")
      .insert({ player_id: playerId, club_id: change.after!.club_id, ...spellFields(change.after!) })
      .select("id")
      .single();
    if (error || !data) {
      console.error("applyClubCleanup insert failed:", error);
      failed++;
    } else {
      insertedIds.set(change.after!.key, data.id);
    }
  }

  const needsOrder = accepted.has("reorder") || insertedIds.size > 0;
  if (needsOrder) {
    const ids = finalOrder(plan, current, accepted)
      .map((p) => p.rowId ?? insertedIds.get(p.key))
      .filter((id): id is number => id !== undefined);
    const ok = await updateClubSortOrders(ids.map((id, i) => ({ id, sort_order: i })));
    if (!ok) failed++;
  }

  return { failed };
}

// --- Club reorder operations ---

export async function updateClubSortOrders(
  updates: { id: number; sort_order: number }[],
): Promise<boolean> {
  if (!supabase) return false;
  for (const { id, sort_order } of updates) {
    const { error } = await supabase
      .from("player_clubs")
      .update({ sort_order })
      .eq("id", id);
    if (error) {
      console.error("updateClubSortOrders failed:", error);
      return false;
    }
  }
  return true;
}

// --- Club name operations ---

export async function updateClubName(clubId: string, name: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("clubs")
    .update({ name })
    .eq("id", clubId);
  if (error) console.error("updateClubName failed:", error);
  return !error;
}

// --- Club crest operations ---

export async function searchClubs(query: string): Promise<{ id: string; name: string; badge: string }[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from("clubs")
    .select("id, name, badge")
    .ilike("name", `%${query}%`)
    .limit(20);
  return data ?? [];
}

// --- Club creation ---

export interface ClubSummary {
  id: string;
  name: string;
  badge: string;
}

/** Escape LIKE wildcards so a club name is matched literally */
function escapeLike(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}

/**
 * Existing clubs with the same or a similar name, "same" first. One `ilike`
 * query per distinctive word of the name (never a string-built `.or()`
 * filter). Throws when a query fails, so the caller doesn't create a
 * duplicate it couldn't check for.
 */
export async function findSimilarClubs(name: string): Promise<RankedClub<ClubSummary>[]> {
  if (!supabase) throw new Error("Supabase is not configured");
  const byId = new Map<string, ClubSummary>();
  for (const term of similarClubSearchTerms(name)) {
    const { data, error } = await supabase
      .from("clubs")
      .select("id, name, badge")
      .ilike("name", `%${escapeLike(term)}%`)
      .limit(50);
    if (error) throw new Error(error.message);
    for (const club of (data ?? []) as ClubSummary[]) byId.set(club.id, club);
  }
  return rankSimilarClubs(name, [...byId.values()]);
}

export async function getCountries(): Promise<{ id: string; name: string }[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("countries").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Insert a club with an `admin_<uuid>` id. Throws with the Supabase message (e.g. RLS for a non-admin). */
export async function createClub({ name, countryId }: { name: string; countryId?: string | null }): Promise<ClubSummary> {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase
    .from("clubs")
    .insert({ id: newCreatedClubId(), name: name.trim(), country_id: countryId || null, badge: "" })
    .select("id, name, badge")
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("The club was not created.");
  return data as ClubSummary;
}

export async function uploadClubCrest(clubId: string, file: File): Promise<string | null> {
  if (!supabase) return null;
  const ext = file.name.split(".").pop() ?? "png";
  return storeClubCrest(supabase, clubId, file, ext);
}

export interface MissingBadgeClub {
  id: string;
  name: string;
  transfermarkt_id: string | null;
  /** How many player_clubs rows point at the club */
  usage_count: number;
}

/** One page of clubs with no badge, most-used first, plus how many there are in total */
export async function getClubsWithoutBadge(
  offset: number,
  limit: number,
): Promise<{ clubs: MissingBadgeClub[]; total: number }> {
  if (!supabase) return { clubs: [], total: 0 };
  const { data, error } = await supabase.rpc("get_clubs_without_badge", { p_offset: offset, p_limit: limit });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as (MissingBadgeClub & { total_count: number })[];
  return {
    clubs: rows.map(({ id, name, transfermarkt_id, usage_count }) => ({ id, name, transfermarkt_id, usage_count })),
    total: rows[0]?.total_count ?? 0,
  };
}

/** Look up a club's logo; a youth team uses its parent club's (see findClubOrParentLogo) */
export async function findLogo(club: LogoClub): Promise<LogoLookup> {
  if (!supabase) throw new Error("Supabase is not configured");
  return findClubOrParentLogo(supabase, club);
}

/**
 * Save a found logo as the club's crest: our own copy of a Wikipedia logo, or
 * the parent club's crest for a youth team. Same-named duplicates without a
 * badge get it too. Throws with a message the UI can show.
 */
export async function saveClubLogo(
  club: { id: string; name: string },
  logo: LogoLookup & { imageUrl: string },
): Promise<{ badge: string; alsoFilled: string[] }> {
  if (!supabase) throw new Error("Supabase is not configured");
  return saveFoundLogo(supabase, club, logo);
}

// --- Player thumbnail operations ---

export async function uploadPlayerThumbnail(playerId: string, file: File): Promise<string | null> {
  if (!supabase) return null;
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${playerId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("player-thumbnails")
    .upload(path, file, { upsert: true });
  if (uploadError) {
    console.error("uploadPlayerThumbnail upload failed:", uploadError);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from("player-thumbnails")
    .getPublicUrl(path);

  // Cache-bust: re-uploads keep the same path, so the URL must change for
  // browsers (and the players row) to pick up the new image
  const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("players")
    .update({ thumbnail: publicUrl })
    .eq("id", playerId);
  if (updateError) {
    console.error("uploadPlayerThumbnail update failed:", updateError);
    return null;
  }

  return publicUrl;
}

export async function updateClubBadge(clubId: string, badgeUrl: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("clubs")
    .update({ badge: badgeUrl })
    .eq("id", clubId);
  if (error) console.error("updateClubBadge failed:", error);
  return !error;
}
