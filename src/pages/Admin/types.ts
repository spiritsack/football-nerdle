import type { Player } from "../../types";

export interface ScheduleEntry {
  date: string;
  player: Player | null;
  isLocked: boolean; // true for past dates or approved future dates
}

export interface AdminClubRow {
  id: number;
  club_id: string;
  club_name: string;
  badge: string;
  year_joined: string;
  year_departed: string;
  is_hidden: boolean;
  sort_order: number | null;
}
