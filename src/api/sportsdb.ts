import type { Player, FormerTeam, PlayerWithTeams } from "../types";

const API_KEY = import.meta.env.VITE_SPORTSDB_API_KEY || "3";
const BASE_URL = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;

interface SportsDbPlayer {
  idPlayer: string;
  strPlayer: string;
  strThumb: string | null;
  strNationality: string | null;
  strSport: string;
}

interface SportsDbFormerTeam {
  idFormerTeam: string;
  strFormerTeam: string;
  strJoined: string;
  strDeparted: string;
}

function mapPlayer(p: SportsDbPlayer): Player {
  return {
    id: p.idPlayer,
    name: p.strPlayer,
    thumbnail: p.strThumb ?? "",
    nationality: p.strNationality ?? "",
  };
}

function mapFormerTeam(t: SportsDbFormerTeam): FormerTeam {
  return {
    teamId: t.idFormerTeam,
    teamName: t.strFormerTeam,
    yearJoined: t.strJoined,
    yearDeparted: t.strDeparted,
  };
}

export async function searchPlayers(query: string): Promise<Player[]> {
  const res = await fetch(`${BASE_URL}/searchplayers.php?p=${encodeURIComponent(query)}`);
  const data = await res.json();
  if (!data.player) return [];
  return (data.player as SportsDbPlayer[])
    .filter((p) => p.strSport === "Soccer")
    .map(mapPlayer);
}

export async function getFormerTeams(playerId: string): Promise<FormerTeam[]> {
  const res = await fetch(`${BASE_URL}/lookupformerteams.php?id=${encodeURIComponent(playerId)}`);
  const data = await res.json();
  if (!data.formerteams) return [];
  return (data.formerteams as SportsDbFormerTeam[]).map(mapFormerTeam);
}

export async function getPlayerWithTeams(player: Player): Promise<PlayerWithTeams> {
  const formerTeams = await getFormerTeams(player.id);
  return { ...player, formerTeams };
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
