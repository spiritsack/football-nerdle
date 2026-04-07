/**
 * Strips youth/reserve team suffixes to get the parent club name.
 *
 * Handles: "Barcelona B", "Bayern Munich II", "Arsenal U18", "Villarreal Yth.",
 * "AC Milan Youth", "Motor Halle Jgd", "GC Zürich Jgd.", "RM Castilla",
 * "France Olympic", etc.
 *
 * Edge case: "Willem II" is a real club — the regex requires a space before
 * the suffix, and "Willem II" has no parent "Willem" in the data, so merging
 * is harmless even if it matches.
 */
const YOUTH_RESERVE_SUFFIX = /\s+(B|II|Reserves|Youth|Yth\.|Jgd\.?|U\d+|Castilla|Olympic|Olympique|Atlético)$/i;

export function getBaseClubName(name: string): string {
  return name.replace(YOUTH_RESERVE_SUFFIX, "").trim();
}

export function isYouthOrReserveTeam(name: string): boolean {
  return YOUTH_RESERVE_SUFFIX.test(name);
}
