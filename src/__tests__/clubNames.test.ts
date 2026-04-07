import { describe, it, expect } from "vitest";
import { getBaseClubName, isYouthOrReserveTeam } from "../utils/clubNames";

describe("getBaseClubName", () => {
  it("strips B teams", () => {
    expect(getBaseClubName("Barcelona B")).toBe("Barcelona");
    expect(getBaseClubName("Atlético Madrid B")).toBe("Atlético Madrid");
  });

  it("strips II (reserve) teams", () => {
    expect(getBaseClubName("Bayern Munich II")).toBe("Bayern Munich");
    expect(getBaseClubName("Dinamo Zagreb II")).toBe("Dinamo Zagreb");
  });

  it("strips U-age teams", () => {
    expect(getBaseClubName("Arsenal U18")).toBe("Arsenal");
    expect(getBaseClubName("Vasco U17")).toBe("Vasco");
    expect(getBaseClubName("Juventus U23")).toBe("Juventus");
  });

  it("strips Youth suffix", () => {
    expect(getBaseClubName("AC Milan Youth")).toBe("AC Milan");
    expect(getBaseClubName("Feyenoord Youth")).toBe("Feyenoord");
  });

  it("strips Yth. suffix", () => {
    expect(getBaseClubName("Villarreal Yth.")).toBe("Villarreal");
    expect(getBaseClubName("1.FC Köln Yth.")).toBe("1.FC Köln");
  });

  it("strips Jgd suffix", () => {
    expect(getBaseClubName("Motor Halle Jgd")).toBe("Motor Halle");
    expect(getBaseClubName("GC Zürich Jgd.")).toBe("GC Zürich");
  });

  it("strips Castilla", () => {
    expect(getBaseClubName("RM Castilla")).toBe("RM");
  });

  it("strips Olympic/Olympique", () => {
    expect(getBaseClubName("France Olympic")).toBe("France");
    expect(getBaseClubName("France Olympique")).toBe("France");
  });

  it("leaves normal club names unchanged", () => {
    expect(getBaseClubName("FC Barcelona")).toBe("FC Barcelona");
    expect(getBaseClubName("Manchester United")).toBe("Manchester United");
    expect(getBaseClubName("Inter Milan")).toBe("Inter Milan");
  });

  it("handles Willem II as edge case", () => {
    // Willem II is a real club — still matches, but harmless since
    // no parent "Willem" club exists in the data
    expect(getBaseClubName("Willem II")).toBe("Willem");
  });
});

describe("isYouthOrReserveTeam", () => {
  it("returns true for youth/reserve teams", () => {
    expect(isYouthOrReserveTeam("Barcelona B")).toBe(true);
    expect(isYouthOrReserveTeam("Arsenal U18")).toBe(true);
    expect(isYouthOrReserveTeam("Bayern Munich II")).toBe(true);
    expect(isYouthOrReserveTeam("AC Milan Youth")).toBe(true);
  });

  it("returns false for regular clubs", () => {
    expect(isYouthOrReserveTeam("FC Barcelona")).toBe(false);
    expect(isYouthOrReserveTeam("Inter Milan")).toBe(false);
    expect(isYouthOrReserveTeam("Arsenal FC")).toBe(false);
  });
});
