export interface PlayerCandidate {
  id_a: string;
  id_b: string;
  name_a: string;
  name_b: string;
  dob_a: string;
  dob_b: string;
  nationality_a: string;
  nationality_b: string;
  thumbnail_a: string;
  thumbnail_b: string;
  position_a: string;
  position_b: string;
  source_a: string;
  source_b: string;
  transfermarkt_id_a: string | null;
  transfermarkt_id_b: string | null;
  stint_count_a: number;
  stint_count_b: number;
  score: number;
  name_sim: number;
  dob_match: boolean;
  same_nationality: boolean;
  cross_source: boolean;
}

export interface ClubCandidate {
  id_a: string;
  id_b: string;
  name_a: string;
  name_b: string;
  country_a: string;
  country_b: string;
  badge_a: string;
  badge_b: string;
  player_count_a: number;
  player_count_b: number;
  score: number;
  name_sim: number;
  same_country: boolean;
  roster_overlap: number;
  shared_player_count: number;
}

export function pickDefaultWinner(c: PlayerCandidate | ClubCandidate): "a" | "b" {
  if ("stint_count_a" in c) {
    const p = c as PlayerCandidate;
    if (p.stint_count_a !== p.stint_count_b) {
      return p.stint_count_a > p.stint_count_b ? "a" : "b";
    }
    if (Boolean(p.transfermarkt_id_a) !== Boolean(p.transfermarkt_id_b)) {
      return p.transfermarkt_id_a ? "a" : "b";
    }
    if (Boolean(p.thumbnail_a) !== Boolean(p.thumbnail_b)) {
      return p.thumbnail_a ? "a" : "b";
    }
    return "a";
  }

  const club = c as ClubCandidate;
  if (club.player_count_a !== club.player_count_b) {
    return club.player_count_a > club.player_count_b ? "a" : "b";
  }
  if (Boolean(club.badge_a) !== Boolean(club.badge_b)) {
    return club.badge_a ? "a" : "b";
  }
  return "a";
}

export function scoreColor(score: number): string {
  if (score >= 0.95) return "text-green-400";
  if (score >= 0.70) return "text-yellow-400";
  return "text-gray-400";
}
