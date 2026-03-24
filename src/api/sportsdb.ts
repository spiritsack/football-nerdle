import type { Player, FormerTeam, PlayerWithTeams } from "../types";

const API_KEY = import.meta.env.VITE_SPORTSDB_API_KEY || "3";
const BASE_URL = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;

export class ApiError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

async function apiFetch(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new ApiError("Network error — check your internet connection");
  }
  if (res.status === 429) {
    throw new ApiError("API rate limit reached — wait a moment and try again", 429);
  }
  if (!res.ok) {
    throw new ApiError(`API error (${res.status})`, res.status);
  }
  try {
    return await res.json();
  } catch {
    throw new ApiError("Invalid response from API");
  }
}

interface SportsDbPlayer {
  idPlayer: string;
  strPlayer: string;
  strThumb: string | null;
  strNationality: string | null;
  strSport: string;
  idTeam: string | null;
  strTeam: string | null;
  dateSigned: string | null;
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
  const data = await apiFetch(`${BASE_URL}/searchplayers.php?p=${encodeURIComponent(query)}`) as { player?: SportsDbPlayer[] };
  if (!data.player) return [];
  return data.player
    .filter((p) => p.strSport === "Soccer")
    .map(mapPlayer);
}

export async function getFormerTeams(playerId: string): Promise<FormerTeam[]> {
  const data = await apiFetch(`${BASE_URL}/lookupformerteams.php?id=${encodeURIComponent(playerId)}`) as { formerteams?: SportsDbFormerTeam[] };
  if (!data.formerteams) return [];
  return data.formerteams.map(mapFormerTeam);
}

async function getCurrentTeam(playerId: string): Promise<FormerTeam | null> {
  const data = await apiFetch(`${BASE_URL}/lookupplayer.php?id=${encodeURIComponent(playerId)}`) as { players?: SportsDbPlayer[] };
  const p = data.players?.[0];
  if (!p?.idTeam || !p.strTeam) return null;
  const year = p.dateSigned ? p.dateSigned.substring(0, 4) : "";
  return {
    teamId: p.idTeam,
    teamName: p.strTeam,
    yearJoined: year,
    yearDeparted: "",
  };
}

export async function getPlayerWithTeams(player: Player): Promise<PlayerWithTeams> {
  const [formerTeams, currentTeam] = await Promise.all([
    getFormerTeams(player.id),
    getCurrentTeam(player.id),
  ]);
  const allTeams = currentTeam
    ? [...formerTeams, currentTeam]
    : formerTeams;
  return { ...player, formerTeams: allTeams };
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
