import { COUNTRY_CODES } from "./constants";

const REGIONAL_INDICATOR_A = 0x1f1e6;
const BLACK_FLAG = 0x1f3f4;
const TAG_LATIN_SMALL_A = 0xe0061;
const CANCEL_TAG = 0xe007f;

/**
 * Map a country name (e.g. "France", "Cote d'Ivoire", "England") to its flag emoji.
 * Returns null for unknown or empty names.
 */
export function getFlagEmoji(nationality: string): string | null {
  const code = COUNTRY_CODES[nationality.trim().toLowerCase()];
  if (!code) return null;

  if (code.startsWith("gb-")) {
    // Subdivision flag: black flag + tag letters for "gbxxx" + cancel tag
    const tags = code.replace("-", "").split("").map((ch) => TAG_LATIN_SMALL_A + ch.charCodeAt(0) - 97);
    return String.fromCodePoint(BLACK_FLAG, ...tags, CANCEL_TAG);
  }

  return String.fromCodePoint(
    ...code.toLowerCase().split("").map((ch) => REGIONAL_INDICATOR_A + ch.charCodeAt(0) - 97),
  );
}
