import { describe, it, expect } from "vitest";
import { HOW_TO_PLAY } from "../pages/Home/constants";
import { MAX_ATTEMPTS } from "../pages/GuessThePlayer/constants";
import { TURN_TIME } from "../constants";

describe("HOW_TO_PLAY", () => {
  it("every mode has a title and 3-5 non-empty rules", () => {
    const modes = Object.values(HOW_TO_PLAY);
    expect(modes.length).toBeGreaterThan(0);
    for (const mode of modes) {
      expect(mode.title.trim()).not.toBe("");
      expect(mode.rules.length).toBeGreaterThanOrEqual(3);
      expect(mode.rules.length).toBeLessThanOrEqual(5);
      for (const rule of mode.rules) {
        expect(rule.trim()).not.toBe("");
      }
    }
  });

  it("rules reference MAX_ATTEMPTS and TURN_TIME", () => {
    expect(HOW_TO_PLAY.guess.rules.join(" ")).toContain(`${MAX_ATTEMPTS} attempts`);
    expect(HOW_TO_PLAY.battle.rules.join(" ")).toContain(`${TURN_TIME} seconds`);
  });
});
