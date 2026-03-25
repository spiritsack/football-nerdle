export interface Player {
  id: string;
  name: string;
  thumbnail: string;
  nationality: string;
}

export interface FormerTeam {
  teamId: string;
  teamName: string;
  yearJoined: string;
  yearDeparted: string;
  badge: string;
}

export interface PlayerWithTeams extends Player {
  formerTeams: FormerTeam[];
}

export type RoomStatus = "waiting" | "playing" | "finished";
export type LoseReason = "wrong" | "timeout" | "disconnect";

export interface GameRoom {
  id: string;
  code: string;
  status: RoomStatus;
  host_id: string;
  guest_id: string | null;
  current_turn: string | null;
  chain: PlayerWithTeams[];
  used_player_ids: string[];
  last_shared_clubs: string[];
  turn_started_at: string | null;
  winner: string | null;
  lose_reason: LoseReason | null;
  score: number;
  created_at: string;
}
