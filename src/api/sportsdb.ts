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
  strMoveType: string;
  strBadge: string | null;
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
    badge: t.strBadge ?? "",
  };
}

export async function searchPlayers(query: string): Promise<Player[]> {
  const data = await apiFetch(`${BASE_URL}/searchplayers.php?p=${encodeURIComponent(query)}`) as { player?: SportsDbPlayer[] };
  if (!data.player) return [];
  return data.player
    .filter((p) => p.strSport === "Soccer")
    .map(mapPlayer);
}

function isValidTeam(t: SportsDbFormerTeam): boolean {
  if (t.strMoveType === "Manager") return false;
  if (t.strFormerTeam.startsWith("_")) return false;
  return true;
}

export async function getFormerTeams(playerId: string): Promise<FormerTeam[]> {
  const data = await apiFetch(`${BASE_URL}/lookupformerteams.php?id=${encodeURIComponent(playerId)}`) as { formerteams?: SportsDbFormerTeam[] };
  if (!data.formerteams) return [];
  const sorted = data.formerteams
    .filter(isValidTeam)
    .map(mapFormerTeam)
    .sort((a, b) => {
      const aYear = parseInt(a.yearJoined, 10) || 0;
      const bYear = parseInt(b.yearJoined, 10) || 0;
      return aYear - bYear;
    });
  return mergeClubStints(sorted);
}

function mergeClubStints(teams: FormerTeam[]): FormerTeam[] {
  const byClub = new Map<string, FormerTeam>();
  for (const team of teams) {
    const existing = byClub.get(team.teamId);
    if (existing) {
      // Keep earliest join
      const existJoin = parseInt(existing.yearJoined, 10) || Infinity;
      const currJoin = parseInt(team.yearJoined, 10) || Infinity;
      if (currJoin < existJoin) {
        existing.yearJoined = team.yearJoined;
      }
      // Keep latest departure
      const existDep = parseInt(existing.yearDeparted, 10) || 0;
      const currDep = parseInt(team.yearDeparted, 10) || 0;
      if (!team.yearDeparted || currDep > existDep) {
        existing.yearDeparted = team.yearDeparted;
      }
    } else {
      byClub.set(team.teamId, { ...team });
    }
  }
  return [...byClub.values()].sort((a, b) => {
    const aYear = parseInt(a.yearJoined, 10) || 0;
    const bYear = parseInt(b.yearJoined, 10) || 0;
    return aYear - bYear;
  });
}

interface CurrentTeamInfo {
  team: FormerTeam | null;
  status: string;
}

async function getCurrentTeamInfo(playerId: string): Promise<CurrentTeamInfo> {
  const data = await apiFetch(`${BASE_URL}/lookupplayer.php?id=${encodeURIComponent(playerId)}`) as { players?: (SportsDbPlayer & { strStatus?: string })[] };
  const p = data.players?.[0];
  const status = p?.strStatus ?? "";
  if (!p?.idTeam || !p.strTeam || status === "Retired" || p.strTeam.startsWith("_")) {
    return { team: null, status };
  }
  const year = p.dateSigned ? p.dateSigned.substring(0, 4) : "";
  return {
    team: {
      teamId: p.idTeam,
      teamName: p.strTeam,
      yearJoined: year,
      yearDeparted: "",
      badge: "",
    },
    status,
  };
}

export async function getPlayerWithTeams(player: Player): Promise<PlayerWithTeams> {
  const [formerTeams, currentInfo] = await Promise.all([
    getFormerTeams(player.id),
    getCurrentTeamInfo(player.id),
  ]);
  const { team: currentTeam } = currentInfo;
  // Only add current team if it's not already in former teams
  const alreadyListed = currentTeam && formerTeams.some((t) => t.teamId === currentTeam.teamId);
  const allTeams = currentTeam && !alreadyListed
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
