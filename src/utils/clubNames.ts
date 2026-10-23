/**
 * Strips youth/reserve team suffixes to get the parent club name.
 *
 * Handles: "Barcelona B", "Bayern Munich II", "Arsenal U18", "Villarreal Yth.",
 * "AC Milan Youth", "Motor Halle Jgd", "GC Zürich Jgd.", "RM Castilla",
 * "France Olympic", "AC Milan Primavera", etc.
 *
 * Edge case: "Willem II" is a real club — the regex requires a space before
 * the suffix, and "Willem II" has no parent "Willem" in the data, so merging
 * is harmless even if it matches.
 */
const YOUTH_RESERVE_SUFFIX = /\s+(B|II|Reserves|Youth|Yth\.|Jgd\.?|U\d+|Castilla|Primavera|Olympic|Olympique|Atlético)$/i;

export function getBaseClubName(name: string): string {
  return name.replace(YOUTH_RESERVE_SUFFIX, "").trim();
}

export function isYouthOrReserveTeam(name: string): boolean {
  return YOUTH_RESERVE_SUFFIX.test(name);
}

/**
 * Normalize club name for matching: strip common suffixes, punctuation differences.
 * "Liverpool F.C." → "liverpool fc"
 * "Fulham Football Club" → "fulham fc"
 * "AS Monaco FC" → "as monaco fc"
 */
export function normalizeClubName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bfootball club\b/g, "fc")
    .replace(/f\.c\./g, "fc")
    .replace(/a\.c\./g, "ac")
    .replace(/s\.c\./g, "sc")
    .replace(/a\.s\./g, "as")
    .replace(/s\.s\.c\./g, "ssc")
    .replace(/s\.l\./g, "sl")
    .replace(/c\.f\./g, "cf")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strip trailing abbreviations entirely for loose matching.
 * "AS Monaco FC" → "as monaco"
 * "Liverpool FC" → "liverpool"
 */
export function stripClubSuffix(name: string): string {
  return normalizeClubName(name)
    .replace(/\s+(fc|ac|sc|ssc|sl|cf|fk|bk|sk|if|ff|afc|sfc|cfc)$/g, "")
    .trim();
}
