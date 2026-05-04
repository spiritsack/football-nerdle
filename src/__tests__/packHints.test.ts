import { describe, it, expect } from "vitest";
import { deriveHints } from "../pages/Pack/hints";
import type { PlayerWithTeams } from "../types";

function makePlayer(overrides: Partial<PlayerWithTeams> = {}): PlayerWithTeams {
  return {
    id: "p1",
    name: "Test Player",
    thumbnail: "",
    nationality: "Brazil",
    position: "Midfielder",
    formerTeams: [
      { teamId: "pack-club", teamName: "Pack FC", yearJoined: "2018", yearDeparted: "2024", badge: "" },
      { teamId: "other-1", teamName: "Other FC", yearJoined: "2014", yearDeparted: "2018", badge: "" },
    ],
    ...overrides,
  };
}

describe("deriveHints", () => {
  it("reveals nothing when there have been no wrong guesses", () => {
    expect(deriveHints(makePlayer(), "pack-club", 0)).toEqual({});
  });

  it("reveals nationality after 1 wrong guess", () => {
    expect(deriveHints(makePlayer(), "pack-club", 1)).toEqual({ nationality: "Brazil" });
  });

  it("reveals position after 2 wrong, keeping nationality", () => {
    expect(deriveHints(makePlayer(), "pack-club", 2)).toEqual({
      nationality: "Brazil",
      position: "Midfielder",
    });
  });

  it("reveals era at the pack club and one other career club after 3 wrong", () => {
    expect(deriveHints(makePlayer(), "pack-club", 3)).toEqual({
      nationality: "Brazil",
      position: "Midfielder",
      era: "2018–2024",
      otherClub: "Other FC",
    });
  });

  it("omits otherClub gracefully when the player has only the pack club", () => {
    const player = makePlayer({
      formerTeams: [
        { teamId: "pack-club", teamName: "Pack FC", yearJoined: "2018", yearDeparted: "2024", badge: "" },
      ],
    });
    const hints = deriveHints(player, "pack-club", 3);
    expect(hints.era).toBe("2018–2024");
    expect(hints.otherClub).toBeUndefined();
    expect("otherClub" in hints).toBe(false);
  });

  it("omits era when the player never appears at the pack club", () => {
    const player = makePlayer({
      formerTeams: [
        { teamId: "other-1", teamName: "Other FC", yearJoined: "2014", yearDeparted: "2018", badge: "" },
      ],
    });
    const hints = deriveHints(player, "pack-club", 3);
    expect(hints.era).toBeUndefined();
    expect(hints.otherClub).toBe("Other FC");
  });
});
