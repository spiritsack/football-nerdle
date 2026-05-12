export type WinnerSide = "a" | "b";
export type CleanupTab = "players" | "clubs" | "stints" | "orphans";

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
