export interface CandidateStint {
  yearJoined: string;
  yearDeparted: string;
  isLoan: boolean;
  isYouth: boolean;
}

export interface CandidateInput {
  id: string;
  name: string;
  thumbnail: string;
  stints: CandidateStint[];
  hasTopLeagueElsewhere: boolean;
}

export interface RankedCandidate {
  id: string;
  name: string;
  thumbnail: string;
  tenure: number;
  tenureLabel: string;
  isLoan: boolean;
  hasTopLeagueElsewhere: boolean;
  inSeedList: boolean;
  score: number;
}

interface RankerOptions {
  limit?: number;
  tenureWeight?: number;
  seedBonus?: number;
  topLeagueBonus?: number;
  loanPenalty?: number;
}

const DEFAULTS = {
  tenureWeight: 1,
  seedBonus: 5,
  topLeagueBonus: 3,
  loanPenalty: -2,
};

function parseYear(s: string): number | null {
  const n = parseInt((s ?? "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function tenureFromStints(stints: CandidateStint[]): number {
  let total = 0;
  for (const s of stints) {
    if (s.isYouth) continue;
    const j = parseYear(s.yearJoined);
    const d = parseYear(s.yearDeparted) ?? new Date().getFullYear();
    if (j === null) continue;
    total += Math.max(0, d - j);
  }
  return total;
}

function tenureLabel(stints: CandidateStint[]): string {
  const firstJoin = stints
    .filter((s) => !s.isYouth)
    .map((s) => parseYear(s.yearJoined))
    .filter((y): y is number => y !== null)
    .reduce((a, b) => Math.min(a, b), Infinity);

  const nonYouth = stints.filter((s) => !s.isYouth);
  const anyOngoing = nonYouth.some((s) => !parseYear(s.yearDeparted));

  if (!Number.isFinite(firstJoin)) return "";
  if (anyOngoing) return `${firstJoin}–present`;

  const lastDepart = nonYouth
    .map((s) => parseYear(s.yearDeparted))
    .filter((y): y is number => y !== null)
    .reduce((a, b) => Math.max(a, b), -Infinity);

  return Number.isFinite(lastDepart) ? `${firstJoin}–${lastDepart}` : `${firstJoin}`;
}

export function rankClubCandidates(
  inputs: CandidateInput[],
  seedPlayerIds: Set<string>,
  options: RankerOptions = {},
): RankedCandidate[] {
  const opts = { ...DEFAULTS, ...options };
  const ranked: RankedCandidate[] = [];

  for (const c of inputs) {
    if (!c.thumbnail) continue;
    const nonYouth = c.stints.filter((s) => !s.isYouth);
    if (nonYouth.length === 0) continue;

    const tenure = tenureFromStints(c.stints);
    const isLoan = nonYouth.some((s) => s.isLoan);
    const inSeedList = seedPlayerIds.has(c.id);

    const score =
      tenure * opts.tenureWeight +
      (inSeedList ? opts.seedBonus : 0) +
      (c.hasTopLeagueElsewhere ? opts.topLeagueBonus : 0) +
      (isLoan ? opts.loanPenalty : 0);

    ranked.push({
      id: c.id,
      name: c.name,
      thumbnail: c.thumbnail,
      tenure,
      tenureLabel: tenureLabel(c.stints),
      isLoan,
      hasTopLeagueElsewhere: c.hasTopLeagueElsewhere,
      inSeedList,
      score,
    });
  }

  ranked.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return options.limit ? ranked.slice(0, options.limit) : ranked;
}
