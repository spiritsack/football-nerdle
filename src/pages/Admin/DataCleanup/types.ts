export type WinnerSide = "a" | "b";
export type CleanupTab = "players" | "clubs" | "stints" | "orphans";

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

export interface StintFragment {
  player_id: string;
  player_name: string;
  club_id: string;
  club_name: string;
  stint_count: number;
  earliest_joined: string;
  latest_departed: string;
}

export interface OrphanPlayer {
  id: string;
  name: string;
  date_born: string;
  nationality: string;
  data_source: string;
  thumbnail: string;
}

export interface OrphanClub {
  id: string;
  name: string;
  country: string;
  badge: string;
}
