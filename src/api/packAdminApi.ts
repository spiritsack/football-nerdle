import { supabase } from "./supabaseClient";
import type { CandidateInput } from "../pages/Admin/packCandidateRanker";

const TOP_LEAGUE_NAMES = new Set([
  "Premier League",
  "LaLiga",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
]);

export async function isPackScheduled(date: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("pack_schedule")
    .select("date")
    .eq("date", date)
    .maybeSingle();
  return !error && !!data;
}

export interface AdminPackPlayer {
  id: string;
  name: string;
  thumbnail: string;
}

export interface AdminPack {
  date: string;
  club: { id: string; name: string; badge: string };
  players: AdminPackPlayer[];
}

interface AdminPackRow {
  date: string;
  club_id: string;
  player_ids: string[];
  clubs: { id: string; name: string; badge: string } | null;
}

export async function getPackForAdmin(date: string): Promise<AdminPack | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("pack_schedule")
    .select("date, club_id, player_ids, clubs(id, name, badge)")
    .eq("date", date)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as AdminPackRow;
  if (!row.clubs) return null;

  const { data: playerRows } = await supabase
    .from("players")
    .select("id, name, thumbnail")
    .in("id", row.player_ids);

  const byId = new Map<string, AdminPackPlayer>();
  for (const p of (playerRows ?? []) as AdminPackPlayer[]) {
    byId.set(p.id, { id: p.id, name: p.name, thumbnail: p.thumbnail ?? "" });
  }
  const players = row.player_ids
    .map((id) => byId.get(id))
    .filter((p): p is AdminPackPlayer => !!p);

  return {
    date: row.date,
    club: { id: row.clubs.id, name: row.clubs.name, badge: row.clubs.badge },
    players,
  };
}

export interface PublishPackResult {
  ok: boolean;
  error?: string;
}

export async function publishPack(
  date: string,
  clubId: string,
  playerIds: string[],
): Promise<PublishPackResult> {
  if (!supabase) return { ok: false, error: "Supabase unavailable" };
  if (playerIds.length !== 10) return { ok: false, error: "Pack must have exactly 10 players" };
  if (new Set(playerIds).size !== 10) return { ok: false, error: "Player list contains duplicates" };

  const { error } = await supabase
    .from("pack_schedule")
    .insert({ date, club_id: clubId, player_ids: playerIds });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updatePack(
  date: string,
  clubId: string,
  playerIds: string[],
): Promise<PublishPackResult> {
  if (!supabase) return { ok: false, error: "Supabase unavailable" };
  if (playerIds.length !== 10) return { ok: false, error: "Pack must have exactly 10 players" };
  if (new Set(playerIds).size !== 10) return { ok: false, error: "Player list contains duplicates" };

  const { error } = await supabase
    .from("pack_schedule")
    .update({ club_id: clubId, player_ids: playerIds })
    .eq("date", date);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

interface ClubMembershipRow {
  player_id: string;
  year_joined: string;
  year_departed: string;
  is_loan: boolean | null;
  is_youth_team: boolean | null;
  is_hidden: boolean | null;
  players: { id: string; name: string; thumbnail: string } | null;
}

interface OtherClubRow {
  player_id: string;
  clubs: { league: string | null } | null;
}

export async function getClubCandidatePool(clubId: string): Promise<CandidateInput[]> {
  if (!supabase) return [];

  const { data: memberships, error } = await supabase
    .from("player_clubs")
    .select("player_id, year_joined, year_departed, is_loan, is_youth_team, is_hidden, players(id, name, thumbnail)")
    .eq("club_id", clubId);

  if (error || !memberships) return [];

  const rows = memberships as unknown as ClubMembershipRow[];
  const playerIds = Array.from(new Set(rows.map((r) => r.player_id)));
  if (playerIds.length === 0) return [];

  // Fetch other-club leagues to flag top-5-league careers.
  const { data: otherClubs } = await supabase
    .from("player_clubs")
    .select("player_id, clubs(league)")
    .in("player_id", playerIds)
    .neq("club_id", clubId);

  const topLeagueByPlayer = new Set<string>();
  for (const r of (otherClubs as unknown as OtherClubRow[] | null) ?? []) {
    if (r.clubs?.league && TOP_LEAGUE_NAMES.has(r.clubs.league)) {
      topLeagueByPlayer.add(r.player_id);
    }
  }

  const byPlayer = new Map<string, CandidateInput>();
  for (const row of rows) {
    if (row.is_hidden) continue;
    if (!row.players) continue;
    const existing = byPlayer.get(row.player_id) ?? {
      id: row.players.id,
      name: row.players.name,
      thumbnail: row.players.thumbnail || "",
      stints: [],
      hasTopLeagueElsewhere: topLeagueByPlayer.has(row.player_id),
    };
    existing.stints.push({
      yearJoined: row.year_joined ?? "",
      yearDeparted: row.year_departed ?? "",
      isLoan: !!row.is_loan,
      isYouth: !!row.is_youth_team,
    });
    byPlayer.set(row.player_id, existing);
  }

  return Array.from(byPlayer.values());
}
