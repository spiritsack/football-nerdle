import { describe, it, expect } from "vitest";
import { getFlagEmoji } from "../components/PlayerCard/helpers";
import { SEED_PLAYERS } from "../data/seedPlayers";

describe("getFlagEmoji", () => {
  it("maps country names to flag emoji", () => {
    expect(getFlagEmoji("France")).toBe("🇫🇷");
    expect(getFlagEmoji("Argentina")).toBe("🇦🇷");
  });

  it("is case/whitespace insensitive", () => {
    expect(getFlagEmoji("  france ")).toBe("🇫🇷");
    expect(getFlagEmoji("ARGENTINA")).toBe("🇦🇷");
  });

  it("handles UK home nations", () => {
    expect(getFlagEmoji("England")).toBe("🏴󠁧󠁢󠁥󠁮󠁧󠁿");
    expect(getFlagEmoji("Scotland")).toBe("🏴󠁧󠁢󠁳󠁣󠁴󠁿");
    expect(getFlagEmoji("Wales")).toBe("🏴󠁧󠁢󠁷󠁬󠁳󠁿");
  });

  it("handles naming variants", () => {
    expect(getFlagEmoji("Ivory Coast")).toBe("🇨🇮");
    expect(getFlagEmoji("Cote d'Ivoire")).toBe("🇨🇮");
    expect(getFlagEmoji("Czech Republic")).toBe("🇨🇿");
    expect(getFlagEmoji("Czechia")).toBe("🇨🇿");
    expect(getFlagEmoji("Türkiye")).toBe("🇹🇷");
    expect(getFlagEmoji("Turkey")).toBe("🇹🇷");
    expect(getFlagEmoji("Korea, South")).toBe("🇰🇷");
    expect(getFlagEmoji("DR Congo")).toBe("🇨🇩");
    expect(getFlagEmoji("Bosnia-Herzegovina")).toBe("🇧🇦");
    expect(getFlagEmoji("United States")).toBe("🇺🇸");
  });

  it("returns null for unknown or empty", () => {
    expect(getFlagEmoji("")).toBeNull();
    expect(getFlagEmoji("Atlantis")).toBeNull();
    expect(getFlagEmoji("Northern Ireland")).toBeNull();
  });

  it("covers all seed player nationalities", () => {
    const missing = [...new Set(SEED_PLAYERS.map((p) => p.nationality))]
      .filter((n) => n && n !== "Northern Ireland")
      .filter((n) => getFlagEmoji(n) === null);
    expect(missing).toEqual([]);
  });
});
