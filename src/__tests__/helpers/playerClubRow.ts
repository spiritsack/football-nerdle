import type { PlayerClubRow } from "../../api/playerCache";

// Builds a player_clubs row joined with its club, for tests.
export function pcRow(club_id: string, name: string, joined: string, departed: string, sort_order: number | null, flags: Partial<PlayerClubRow> = {}): PlayerClubRow {
  return {
    club_id, year_joined: joined, year_departed: departed, sort_order,
    is_hidden: false, is_youth_team: false, is_loan: false,
    clubs: { id: club_id, name, badge: "" },
    ...flags,
  };
}
