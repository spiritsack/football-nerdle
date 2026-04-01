import type { PlayerWithTeams } from "../types";

export class ApiError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

function parseYear(y: string): number | null {
  const n = parseInt(y, 10);
  return isNaN(n) ? null : n;
}

export function didPlayTogether(
  a: PlayerWithTeams,
  b: PlayerWithTeams
): { together: boolean; clubs: string[] } {
  const sharedClubs: string[] = [];

  for (const teamA of a.formerTeams) {
    for (const teamB of b.formerTeams) {
      if (teamA.teamId !== teamB.teamId) continue;

      const aJoined = parseYear(teamA.yearJoined);
      const aDeparted = parseYear(teamA.yearDeparted);
      const bJoined = parseYear(teamB.yearJoined);
      const bDeparted = parseYear(teamB.yearDeparted);

      // If we can't parse years, accept the club match
      if (aJoined === null || bJoined === null) {
        sharedClubs.push(teamA.teamName);
        continue;
      }

      // Use current year as departure if still at club
      const aEnd = aDeparted ?? new Date().getFullYear();
      const bEnd = bDeparted ?? new Date().getFullYear();

      // Check year overlap: A's time and B's time at the same club intersect
      if (aJoined <= bEnd && bJoined <= aEnd) {
        sharedClubs.push(teamA.teamName);
      }
    }
  }

  return {
    together: sharedClubs.length > 0,
    clubs: [...new Set(sharedClubs)],
  };
}
