import { describe, it, expect } from "vitest";
import { getDailyPlayerIndex, getDayNumber, getDateForDay, getGuessAnnouncement, getArchiveDayError, formatCountdown } from "../pages/GuessThePlayer/helpers";
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
