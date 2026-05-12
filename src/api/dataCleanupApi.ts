import { supabase } from "./supabaseClient";
import type { PlayerCandidate, ClubCandidate } from "../pages/Admin/DataCleanup/helpers";

export async function findDuplicatePlayerCandidates(
  minScore = 0.55,
  maxResults = 50,
): Promise<PlayerCandidate[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("find_duplicate_player_candidates", {
    min_score: minScore,
    max_results: maxResults,
  });
  if (error) {
    console.error("findDuplicatePlayerCandidates failed:", error);
    return [];
  }
  return data ?? [];
}

export async function findDuplicateClubCandidates(
  minScore = 0.55,
  maxResults = 50,
): Promise<ClubCandidate[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("find_duplicate_club_candidates", {
    min_score: minScore,
    max_results: maxResults,
  });
  if (error) {
    console.error("findDuplicateClubCandidates failed:", error);
    return [];
  }
  return data ?? [];
}

export async function dismissDuplicate(
  entityType: "player" | "club",
  idA: string,
  idB: string,
  reason = "",
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc("dismiss_duplicate", {
    p_entity_type: entityType,
    p_id_a: idA,
    p_id_b: idB,
    p_reason: reason,
  });
  if (error) {
    console.error("dismissDuplicate failed:", error);
    return false;
  }
  return true;
}

export async function mergePlayers(
  winnerId: string,
  loserId: string,
): Promise<{ stints_moved: number; stints_dropped: number; schedule_moved: number } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("merge_players", {
    p_winner_id: winnerId,
    p_loser_id: loserId,
  });
  if (error) {
    console.error("mergePlayers failed:", error);
    return null;
  }
  return data;
}

export async function mergeClubs(
  winnerId: string,
  loserId: string,
): Promise<{ stints_moved: number; stints_dropped: number; players_updated: number } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("merge_clubs", {
    p_winner_id: winnerId,
    p_loser_id: loserId,
  });
  if (error) {
    console.error("mergeClubs failed:", error);
    return null;
  }
  return data;
}
