import type { FormerTeam, PlayerWithTeams } from "../../types";

export interface PackHints {
  nationality?: string;
  position?: string;
  era?: string;
  otherClub?: string;
}

export function deriveHints(
  player: PlayerWithTeams,
  packClubId: string,
  wrongCount: number,
): PackHints {
  const hints: PackHints = {};
  if (wrongCount >= 1 && player.nationality) hints.nationality = player.nationality;
  if (wrongCount >= 2 && player.position) hints.position = player.position;
  if (wrongCount >= 3) {
    const era = formatEra(player.formerTeams.find((t) => t.teamId === packClubId));
    if (era) hints.era = era;
    const other = player.formerTeams.find((t) => t.teamId !== packClubId);
    if (other) hints.otherClub = other.teamName;
  }
  return hints;
}

function formatEra(team: FormerTeam | undefined): string | undefined {
  if (!team) return undefined;
  const j = team.yearJoined?.trim();
  const d = team.yearDeparted?.trim();
  if (j && d) return `${j}–${d}`;
  if (j) return `${j}–present`;
  if (d) return `until ${d}`;
  return undefined;
}
