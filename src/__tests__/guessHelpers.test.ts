import { describe, it, expect, vi } from "vitest";
import { getDailyPlayerIndex, getDayNumber, getDateForDay, getGuessAnnouncement, shareResult } from "../pages/GuessThePlayer/helpers";
import type { ShareNavigator } from "../pages/GuessThePlayer/types";
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
