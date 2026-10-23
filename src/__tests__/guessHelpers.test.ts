import { describe, it, expect, vi } from "vitest";
import { mergeConsecutiveClubs, getDailyPlayerIndex, getDayNumber, getDateForDay, getGuessAnnouncement, getAlreadyGuessedMap, getArchiveDayError, formatCountdown, formatWrongGuesses, shareResult, createLoadGuard } from "../pages/GuessThePlayer/helpers";
import type { ShareNavigator } from "../pages/GuessThePlayer/types";
import { toFormerTeams, type PlayerClubRow } from "../api/playerCache";
import { pcRow } from "./helpers/playerClubRow";
import { SEED_PLAYERS } from "../data/seedPlayers";

describe("getDailyPlayerIndex (fallback sequential algorithm)", () => {
  it("returns a consistent index for the same date", () => {
    const idx1 = getDailyPlayerIndex("2026-03-26");
    const idx2 = getDailyPlayerIndex("2026-03-26");
    expect(idx1).toBe(idx2);
  });

  it("returns different indices for consecutive dates", () => {
    const idx1 = getDailyPlayerIndex("2026-03-26");
    const idx2 = getDailyPlayerIndex("2026-03-27");
    expect(idx1).not.toBe(idx2);
  });

  it("returns an index within seed player bounds", () => {
    for (let day = 0; day < 365; day++) {
      const date = new Date("2026-03-24T12:00:00Z");
      date.setUTCDate(date.getUTCDate() + day);
      const dateStr = date.toISOString().split("T")[0];
      const idx = getDailyPlayerIndex(dateStr);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(SEED_PLAYERS.length);
    }
  });

  it("day 1 (2026-03-24) returns index 0", () => {
    expect(getDailyPlayerIndex("2026-03-24")).toBe(0);
  });

  it("day 3 (2026-03-26) returns index 2", () => {
    expect(getDailyPlayerIndex("2026-03-26")).toBe(2);
  });

  it("never repeats within one full cycle", () => {
    const seen = new Set<number>();
    for (let day = 0; day < SEED_PLAYERS.length; day++) {
      const date = new Date("2026-03-24T12:00:00Z");
      date.setUTCDate(date.getUTCDate() + day);
      const dateStr = date.toISOString().split("T")[0];
      const idx = getDailyPlayerIndex(dateStr);
      expect(seen.has(idx)).toBe(false);
      seen.add(idx);
    }
  });
});

describe("getDayNumber", () => {
  it("returns 1 for the start date", () => {
    expect(getDayNumber("2026-03-24")).toBe(1);
  });

  it("returns 2 for the day after start", () => {
    expect(getDayNumber("2026-03-25")).toBe(2);
  });

  it("returns 3 for 2026-03-26", () => {
    expect(getDayNumber("2026-03-26")).toBe(3);
  });

  it("increments by 1 for each day", () => {
    const day10 = getDayNumber("2026-04-02");
    const day11 = getDayNumber("2026-04-03");
    expect(day11 - day10).toBe(1);
  });
});

describe("getDateForDay", () => {
  it("day 1 returns start date", () => {
    expect(getDateForDay(1)).toBe("2026-03-24");
  });

  it("day 2 returns day after start", () => {
    expect(getDateForDay(2)).toBe("2026-03-25");
  });

  it("is inverse of getDayNumber", () => {
    for (let day = 1; day <= 30; day++) {
      const date = getDateForDay(day);
      expect(getDayNumber(date)).toBe(day);
    }
  });
});

describe("getGuessAnnouncement", () => {
  it("announces a wrong guess with plural attempts left", () => {
    expect(getGuessAnnouncement({ kind: "wrong", guessName: "Robert Lewandowski", attemptsLeft: 4 }))
      .toBe("Wrong guess: Robert Lewandowski. 4 attempts left.");
  });

  it("announces a wrong guess with a single attempt left", () => {
    expect(getGuessAnnouncement({ kind: "wrong", guessName: "Kaka", attemptsLeft: 1 }))
      .toBe("Wrong guess: Kaka. 1 attempt left.");
  });

  it("announces a skip with plural attempts left", () => {
    expect(getGuessAnnouncement({ kind: "skip", attemptsLeft: 3 })).toBe("Skipped. 3 attempts left.");
  });

  it("announces a skip with a single attempt left", () => {
    expect(getGuessAnnouncement({ kind: "skip", attemptsLeft: 1 })).toBe("Skipped. 1 attempt left.");
  });

  it("announces a win in multiple attempts", () => {
    expect(getGuessAnnouncement({ kind: "won", targetName: "Lionel Messi", attempts: 3 }))
      .toBe("Correct! It was Lionel Messi. Guessed in 3 attempts.");
  });

  it("announces a win in a single attempt", () => {
    expect(getGuessAnnouncement({ kind: "won", targetName: "Lionel Messi", attempts: 1 }))
      .toBe("Correct! It was Lionel Messi. Guessed in 1 attempt.");
  });

  it("announces a loss with the target name", () => {
    expect(getGuessAnnouncement({ kind: "lost", targetName: "Thierry Henry" }))
      .toBe("Out of attempts. The player was Thierry Henry.");
  });
});

describe("shareResult", () => {
  const TEXT = "Football Nerdle #1\n🔴🔴🔴🔴🔴\nhttps://spiritsack.github.io/football-nerdle/#/guess";

  function domError(name: string): Error {
    const err = new Error(name);
    err.name = name;
    return err;
  }

  function fakeNav(opts: {
    share?: ReturnType<typeof vi.fn>;
    canShare?: ReturnType<typeof vi.fn>;
    writeText?: ReturnType<typeof vi.fn>;
  }): ShareNavigator {
    const nav: Record<string, unknown> = {};
    if (opts.share) nav.share = opts.share;
    if (opts.canShare) nav.canShare = opts.canShare;
    if (opts.writeText) nav.clipboard = { writeText: opts.writeText };
    return nav as ShareNavigator;
  }

  it("uses navigator.share when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    const writeText = vi.fn().mockResolvedValue(undefined);
    const result = await shareResult(TEXT, fakeNav({ share, canShare, writeText }));
    expect(result).toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({ text: TEXT });
    expect(canShare).toHaveBeenCalledWith({ text: TEXT });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("uses navigator.share when canShare is absent", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareResult(TEXT, fakeNav({ share, writeText }))).toBe("shared");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("skips share when canShare is false", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    const result = await shareResult(TEXT, fakeNav({ share, canShare, writeText }));
    expect(result).toBe("copied");
    expect(share).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith(TEXT);
  });

  it("treats AbortError as cancelled", async () => {
    const share = vi.fn().mockRejectedValue(domError("AbortError"));
    const writeText = vi.fn().mockResolvedValue(undefined);
    const result = await shareResult(TEXT, fakeNav({ share, writeText }));
    expect(result).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to clipboard when share fails", async () => {
    const share = vi.fn().mockRejectedValue(domError("NotAllowedError"));
    const writeText = vi.fn().mockResolvedValue(undefined);
    const result = await shareResult(TEXT, fakeNav({ share, writeText }));
    expect(result).toBe("copied");
    expect(share).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(TEXT);
  });

  it("copies when share unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareResult(TEXT, fakeNav({ writeText }))).toBe("copied");
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(TEXT);
  });

  it("returns failed when clipboard rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(domError("NotAllowedError"));
    await expect(shareResult(TEXT, fakeNav({ writeText }))).resolves.toBe("failed");
  });

  it("returns failed when clipboard missing", async () => {
    await expect(shareResult(TEXT, fakeNav({}))).resolves.toBe("failed");
  });

  it("returns failed when share fails and clipboard is missing", async () => {
    const share = vi.fn().mockRejectedValue(new TypeError("boom"));
    await expect(shareResult(TEXT, fakeNav({ share }))).resolves.toBe("failed");
  });
});

describe("formatWrongGuesses", () => {
  it("returns an empty string when there are no wrong guesses", () => {
    expect(formatWrongGuesses([])).toBe("");
  });

  it("formats a single wrong guess", () => {
    expect(formatWrongGuesses([{ name: "Robert Lewandowski" }])).toBe("Wrong: Robert Lewandowski");
  });

  it("joins multiple wrong guesses in the order they were made", () => {
    expect(formatWrongGuesses([{ name: "A" }, { name: "B" }])).toBe("Wrong: A, B");
    expect(formatWrongGuesses([{ name: "C" }, { name: "A" }, { name: "B" }])).toBe("Wrong: C, A, B");
  });
});

describe("getAlreadyGuessedMap", () => {
  const messi = { id: "tm_28003", name: "Lionel Messi", thumbnail: "", nationality: "Argentina" };
  const haaland = { id: "tm_418560", name: "Erling Haaland", thumbnail: "", nationality: "Norway" };

  it("returns an empty map for no wrong guesses", () => {
    expect(getAlreadyGuessedMap([]).size).toBe(0);
  });

  it("maps each wrong guess id to the Already guessed label", () => {
    const map = getAlreadyGuessedMap([messi, haaland]);
    expect(map.size).toBe(2);
    expect(map.get("tm_28003")).toBe("Already guessed");
    expect(map.get("tm_418560")).toBe("Already guessed");
  });

  it("does not create extra entries for duplicates", () => {
    const map = getAlreadyGuessedMap([messi, messi]);
    expect(map.size).toBe(1);
    expect(map.get("tm_28003")).toBe("Already guessed");
  });
});

describe("getArchiveDayError", () => {
  const todayNum = 200;
  const invalid = "That isn't a valid day.";
  const future = "This day hasn't happened yet.";

  it("rejects non-integer days as invalid", () => {
    expect(getArchiveDayError(NaN, todayNum)).toBe(invalid);
    expect(getArchiveDayError(1.5, todayNum)).toBe(invalid);
  });

  it("rejects days before day 1 or after today as not yet happened", () => {
    expect(getArchiveDayError(0, todayNum)).toBe(future);
    expect(getArchiveDayError(-1, todayNum)).toBe(future);
    expect(getArchiveDayError(todayNum + 1, todayNum)).toBe(future);
  });

  it("accepts day 1 and today", () => {
    expect(getArchiveDayError(1, todayNum)).toBeNull();
    expect(getArchiveDayError(todayNum, todayNum)).toBeNull();
  });
});

describe("formatCountdown", () => {
  it("returns 00:00:00 for zero and negative durations", () => {
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(-5000)).toBe("00:00:00");
  });

  it("rounds partial seconds up", () => {
    expect(formatCountdown(1)).toBe("00:00:01");
    expect(formatCountdown(1001)).toBe("00:00:02");
  });

  it("formats hours, minutes and seconds zero-padded", () => {
    expect(formatCountdown(3_661_000)).toBe("01:01:01");
    expect(formatCountdown(86_399_000)).toBe("23:59:59");
  });
});

describe("createLoadGuard", () => {
  it("marks the latest load as current", () => {
    const g = createLoadGuard();
    const a = g.begin();
    expect(a()).toBe(true);
  });

  it("supersedes an older load when a newer one begins", () => {
    const g = createLoadGuard();
    const a = g.begin();
    const b = g.begin();
    expect(a()).toBe(false);
    expect(b()).toBe(true);
  });

  it("keeps an older load stale after further loads", () => {
    const g = createLoadGuard();
    const a = g.begin();
    g.begin();
    const c = g.begin();
    expect(a()).toBe(false);
    expect(c()).toBe(true);
  });

  it("keeps separate guards independent", () => {
    const g1 = createLoadGuard();
    const g2 = createLoadGuard();
    const a = g1.begin();
    const b = g2.begin();
    g2.begin();
    expect(a()).toBe(true);
    expect(b()).toBe(false);
  });
});

// Rows shaped like player_clubs for Fikayo Tomori (tm_303254, daily puzzle 2026-10-21):
// a loan to AC Milan (tm_5) then a permanent move (tm_10958), both named "AC Milan".
const TOMORI_ROWS: PlayerClubRow[] = [
  pcRow("tm_631", "Chelsea FC", "2017", "2021", 3),
  pcRow("tm_9250", "Chelsea U23", "2015", "2017", 2, { is_youth_team: true }),
  pcRow("tm_6918", "Chelsea U18", "2014", "2015", 1, { is_youth_team: true }),
  pcRow("tm_1237", "Brighton and Hove Albion Football Club", "2017", "2017", 4, { is_loan: true }),
  pcRow("tm_22", "Derby County", "2018", "2019", 6, { is_loan: true }),
  pcRow("tm_3008", "Hull City", "2017", "2018", 5, { is_loan: true }),
  pcRow("tm_10958", "AC Milan", "2021", "", 8),
  pcRow("tm_5", "AC Milan", "2021", "2021", 7, { is_loan: true }),
  pcRow("tm_50677", "Chelsea Youth", "", "2014", 0, { is_youth_team: true }),
];

describe("mergeConsecutiveClubs", () => {
  it("returns an empty list for no clubs", () => {
    expect(mergeConsecutiveClubs([])).toEqual([]);
  });

  it("keeps the last club when a loan is followed by a permanent move to the same club", () => {
    const tiles = mergeConsecutiveClubs(toFormerTeams(TOMORI_ROWS, new Set()));
    expect(tiles.map((t) => t.teamName)).toEqual([
      "Chelsea FC", "Brighton and Hove Albion Football Club", "Hull City", "Derby County", "AC Milan", "AC Milan",
    ]);
    const loan = tiles[4];
    expect(loan).toMatchObject({ teamId: "tm_5", yearJoined: "2021", yearDeparted: "2021", isLoan: true });
    const last = tiles[5];
    expect(last).toMatchObject({ teamId: "tm_10958", yearJoined: "2021", yearDeparted: "" });
    expect(last.isLoan).toBeFalsy();
  });

  it("keeps a permanent spell separate from a following loan to the same club", () => {
    const tiles = mergeConsecutiveClubs([
      { teamId: "a", teamName: "Club A", yearJoined: "2015", yearDeparted: "2018", badge: "" },
      { teamId: "a2", teamName: "Club A", yearJoined: "2018", yearDeparted: "2019", badge: "", isLoan: true },
    ]);
    expect(tiles).toHaveLength(2);
    expect(tiles[1].isLoan).toBe(true);
  });

  it("still merges consecutive B/II/U-team stints", () => {
    const tiles = mergeConsecutiveClubs([
      { teamId: "b", teamName: "Barcelona B", yearJoined: "2010", yearDeparted: "2012", badge: "" },
      { teamId: "f", teamName: "Barcelona", yearJoined: "2012", yearDeparted: "", badge: "x" },
      { teamId: "u", teamName: "Bayern Munich II", yearJoined: "", yearDeparted: "", badge: "" },
    ]);
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toMatchObject({ teamName: "Barcelona", yearJoined: "2010", yearDeparted: "", badge: "x" });
    expect(tiles[0].stints).toHaveLength(2);
  });

  it("still merges two consecutive loans at the same club", () => {
    const tiles = mergeConsecutiveClubs([
      { teamId: "a", teamName: "Club A", yearJoined: "2015", yearDeparted: "2016", badge: "", isLoan: true },
      { teamId: "a", teamName: "Club A", yearJoined: "2016", yearDeparted: "2017", badge: "", isLoan: true },
    ]);
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toMatchObject({ yearJoined: "2015", yearDeparted: "2017", isLoan: true });
  });
});
