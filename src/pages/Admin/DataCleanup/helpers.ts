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

export function pickDefaultWinner(c: PlayerCandidate | ClubCandidate): "a" | "b" {
  if ("stint_count_a" in c) {
    if (c.stint_count_a !== c.stint_count_b) {
      return c.stint_count_a > c.stint_count_b ? "a" : "b";
    }
    if (Boolean(c.transfermarkt_id_a) !== Boolean(c.transfermarkt_id_b)) {
      return c.transfermarkt_id_a ? "a" : "b";
    }
    if (Boolean(c.thumbnail_a) !== Boolean(c.thumbnail_b)) {
      return c.thumbnail_a ? "a" : "b";
    }
    return "a";
  }

  if (c.player_count_a !== c.player_count_b) {
    return c.player_count_a > c.player_count_b ? "a" : "b";
  }
  if (Boolean(c.badge_a) !== Boolean(c.badge_b)) {
    return c.badge_a ? "a" : "b";
  }
  return "a";
}

export function scoreColor(score: number): string {
  if (score >= 0.95) return "text-green-400";
  if (score >= 0.70) return "text-yellow-400";
  return "text-gray-400";
}

interface YearRange {
  year_joined: string;
  year_departed: string;
}

function parseYear(s: string): number | null {
  if (!s) return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

export function areStintsOverlapping(a: YearRange, b: YearRange): boolean {
  const aStart = parseYear(a.year_joined);
  const bStart = parseYear(b.year_joined);
  if (aStart === null || bStart === null) return false;

  const currentYear = new Date().getFullYear();
  const aEnd = parseYear(a.year_departed) ?? currentYear;
  const bEnd = parseYear(b.year_departed) ?? currentYear;

  return aStart <= bEnd + 1 && bStart <= aEnd + 1;
}

export function computeMergedRange(stints: YearRange[]): YearRange {
  if (stints.length === 0) return { year_joined: "", year_departed: "" };

  let earliest = Infinity;
  let latest = -Infinity;
  let hasOngoing = false;

  for (const s of stints) {
    const start = parseYear(s.year_joined);
    if (start !== null && start < earliest) earliest = start;
    if (!s.year_departed) {
      hasOngoing = true;
    } else {
      const end = parseYear(s.year_departed);
      if (end !== null && end > latest) latest = end;
    }
  }

  return {
    year_joined: earliest === Infinity ? "" : String(earliest),
    year_departed: hasOngoing ? "" : (latest === -Infinity ? "" : String(latest)),
  };
}
