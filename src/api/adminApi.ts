import { supabase } from "./supabaseClient";
import type { Player } from "../types";
import type { AdminClubRow } from "../pages/Admin/types";

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

export async function uploadClubCrest(clubId: string, file: File): Promise<string | null> {
  if (!supabase) return null;
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${clubId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("club-crests")
    .upload(path, file, { upsert: true });
  if (uploadError) {
    console.error("uploadClubCrest upload failed:", uploadError);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from("club-crests")
    .getPublicUrl(path);

  const publicUrl = urlData.publicUrl;

  // Update the club record with the new badge URL
  const { error: updateError } = await supabase
    .from("clubs")
    .update({ badge: publicUrl })
    .eq("id", clubId);
  if (updateError) console.error("uploadClubCrest update failed:", updateError);

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
