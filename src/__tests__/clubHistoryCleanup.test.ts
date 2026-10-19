import { describe, it, expect } from "vitest";
import {
  buildTargetHistory,
  extractInfobox,
  finalOrder,
  isYouthName,
  parseClub,
  parseInfobox,
  parseYears,
  planCleanup,
  resolveClub,
  unresolvedClubNames,
} from "../pages/Admin/clubHistoryCleanup";
import type { InfoboxCareer, TargetSpell } from "../pages/Admin/clubHistoryCleanup";
import type { AdminClubRow } from "../pages/Admin/types";
import lukakuWikitext from "./fixtures/wikipedia/Romelu_Lukaku.wikitext?raw";
import pirloWikitext from "./fixtures/wikipedia/Andrea_Pirlo.wikitext?raw";
import rashfordWikitext from "./fixtures/wikipedia/Marcus_Rashford.wikitext?raw";

function row(
  id: number,
  club_id: string,
  club_name: string,
  year_joined: string,
  year_departed: string,
  flags: Partial<Pick<AdminClubRow, "is_loan" | "is_youth_team" | "is_hidden">> = {},
): AdminClubRow {
  return {
    id, club_id, club_name, badge: "", year_joined, year_departed,
    is_hidden: false, is_youth_team: false, is_loan: false, sort_order: id,
    ...flags,
  };
}

function spellText(s: TargetSpell): string {
  return `${s.name} ${s.from}–${s.to ?? ""}${s.loan ? " (loan)" : ""}`;
}

function career(wikitext: string): InfoboxCareer {
  const result = parseInfobox(wikitext);
  if (!result) throw new Error("no infobox");
  return result;
}

function infobox(lines: string[]): string {
  return `Intro text\n{{Infobox football biography\n| name = Test Player\n${lines.join("\n")}\n}}\nBody`;
}

// Romelu Lukaku's player_clubs rows in production (Oct 2026): a long Chelsea
// spell beside the loans, the Inter loan mislabelled, youth teams not hidden
const LUKAKU_ROWS: AdminClubRow[] = [
  row(1, "tm_34285", "Lierse SK Yth.", "", "2006", { is_youth_team: true }),
  row(2, "tm_25005", "Anderlecht Yth.", "2006", "2008", { is_youth_team: true }),
  row(3, "tm_49390", "Anderlecht U17", "2008", "2009", { is_youth_team: true }),
  row(4, "tm_58", "RSC Anderlecht", "2009", "2011"),
  row(5, "tm_631", "Chelsea FC", "2011", "2024"),
  row(6, "tm_984", "West Bromwich Albion", "2012", "2013", { is_loan: true }),
  row(7, "tm_29", "Everton FC", "2013", "2014", { is_loan: true }),
  row(8, "tm_29", "Everton FC", "2014", "2017"),
  row(9, "tm_985", "Manchester United", "2017", "2019"),
  row(10, "tm_631", "Chelsea FC", "2021", "2024"),
  row(11, "tm_46", "Inter Milan", "2019", "2023", { is_loan: true }),
  row(12, "tm_12", "AS Roma", "2023", "2024", { is_loan: true }),
  row(13, "tm_6195", "Napoli", "2024", ""),
];

describe("parseYears", () => {
  it("reads ranges, open spells and single years", () => {
    expect(parseYears("2009–2011")).toEqual({ from: 2009, to: 2011 });
    expect(parseYears("2026–")).toEqual({ from: 2026, to: null });
    expect(parseYears("2001")).toEqual({ from: 2001, to: 2001 });
    expect(parseYears("2013–14")).toEqual({ from: 2013, to: 2014 });
    expect(parseYears("{{0}}2010-2012")).toEqual({ from: 2010, to: 2012 });
  });

  it("returns null for anything it can't read", () => {
    expect(parseYears("")).toBeNull();
    expect(parseYears("c. 1990")).toBeNull();
    expect(parseYears("2015–2012")).toBeNull();
  });
});

describe("parseClub", () => {
  it("reads link label and target, and the loan arrow", () => {
    expect(parseClub("→ [[Reggina Calcio|Reggina]] (loan)")).toEqual({
      name: "Reggina", names: ["Reggina", "Reggina Calcio"], loan: true,
    });
    expect(parseClub("[[Inter Milan]]")).toEqual({ name: "Inter Milan", names: ["Inter Milan"], loan: false });
  });

  it("drops Wikipedia disambiguators, refs and nowrap", () => {
    expect(parseClub("[[Fenerbahçe S.K. (football)|Fenerbahçe]]<ref>x</ref>")?.names).toEqual(["Fenerbahçe", "Fenerbahçe S.K."]);
    expect(parseClub("{{nowrap|[[Borussia Dortmund]]}}")?.name).toBe("Borussia Dortmund");
    expect(parseClub("KFC Wintam")?.names).toEqual(["KFC Wintam"]);
  });
});

describe("isYouthName", () => {
  it("recognises youth and reserve sides", () => {
    for (const name of ["Juventus U23", "Arsenal U19", "Barcelona B", "Bayern Munich II", "Inter Primavera",
      "Ajax Youth", "Manchester United F.C. Reserves and Academy", "Lierse SK Yth.", "Chelsea Academy"]) {
      expect(isYouthName(name), name).toBe(true);
    }
  });

  it("leaves first teams alone", () => {
    for (const name of ["Chelsea FC", "Willem II Tilburg", "Real Betis", "Club Brugge"]) {
      expect(isYouthName(name), name).toBe(false);
    }
  });
});

describe("parseInfobox", () => {
  it("returns null without a football infobox", () => {
    expect(extractInfobox("{{Infobox person\n| name = X\n}}")).toBeNull();
    expect(parseInfobox("No infobox here")).toBeNull();
  });

  it("parses youth clubs, senior clubs, loans and the current club (Lukaku)", () => {
    const c = career(lukakuWikitext);
    expect(c.youth.map((y) => y.name)).toEqual(["Rupel Boom", "KFC Wintam", "Lierse", "Anderlecht"]);
    expect(c.senior).toHaveLength(12);
    expect(c.senior.filter((s) => s.loan).map((s) => s.name)).toEqual(["West Bromwich Albion", "Everton", "Inter Milan", "Roma"]);
    expect(c.senior[11]).toMatchObject({ name: "Fenerbahçe", years: { from: 2026, to: null }, loan: false });
    expect(c.currentClub?.name).toBe("Fenerbahçe");
  });

  it("ignores a coaching job as the current club (Pirlo)", () => {
    const c = career(pirloWikitext);
    expect(c.currentClub).toBeNull();
    expect(c.senior.map((s) => s.name)).toEqual(["Brescia", "Inter Milan", "Reggina", "Brescia", "AC Milan", "Juventus", "New York City FC"]);
  });

  it("treats a reserve side in the senior list as youth", () => {
    const c = career(infobox([
      "| years1 = 2010–2012", "| clubs1 = [[FC Barcelona Atlètic|Barcelona B]]",
      "| years2 = 2012–2016", "| clubs2 = [[FC Barcelona|Barcelona]]",
    ]));
    expect(c.youth.map((y) => y.name)).toEqual(["Barcelona B"]);
    expect(c.senior.map((s) => s.name)).toEqual(["Barcelona"]);
  });
});

describe("buildTargetHistory", () => {
  it("splits the parent club's spell around a loan", () => {
    const c = career(infobox([
      "| years1 = 2010–2015", "| clubs1 = [[Inter Milan|Inter]]",
      "| years2 = 2012–2013", "| clubs2 = → [[Juventus FC|Juventus]] (loan)",
    ]));
    expect(buildTargetHistory(c).spells.map(spellText)).toEqual([
      "Inter 2010–2012", "Juventus 2012–2013 (loan)", "Inter 2013–2015",
    ]);
  });

  it("splits several times for several loans, and drops zero-length gaps (Lukaku)", () => {
    const { spells, review } = buildTargetHistory(career(lukakuWikitext));
    expect(spells.map(spellText)).toEqual([
      "Anderlecht 2009–2011",
      "Chelsea 2011–2012",
      "West Bromwich Albion 2012–2013 (loan)",
      "Everton 2013–2014 (loan)",
      "Everton 2014–2017", // loan made permanent: starts when the loan ends
      "Manchester United 2017–2019",
      "Inter Milan 2019–2021",
      "Chelsea 2021–2022",
      "Inter Milan 2022–2023 (loan)",
      "Roma 2023–2024 (loan)",
      "Napoli 2024–2026",
      "Fenerbahçe 2026–",
    ]);
    expect(review).toEqual([]);
  });

  it("keeps a single-year loan and the return in between (Pirlo)", () => {
    expect(buildTargetHistory(career(pirloWikitext)).spells.map(spellText)).toEqual([
      "Brescia 1995–1998",
      "Inter Milan 1998–1999",
      "Reggina 1999–2000 (loan)",
      "Inter Milan 2000–2001",
      "Brescia 2001–2001 (loan)",
      "AC Milan 2001–2011",
      "Juventus 2011–2015",
      "New York City FC 2015–2017",
    ]);
  });

  it("resumes an open-ended parent spell after its loans (Rashford)", () => {
    expect(buildTargetHistory(career(rashfordWikitext)).spells.map(spellText)).toEqual([
      "Manchester United 2015–2025",
      "Aston Villa 2025–2025 (loan)",
      "Barcelona 2025–2026 (loan)",
      "Manchester United 2026–",
    ]);
  });

  it("flags loans outside the parent spell and unreadable years instead of guessing", () => {
    const { spells, review } = buildTargetHistory(career(infobox([
      "| years1 = 2010–2012", "| clubs1 = [[Ajax]]",
      "| years2 = 2013–2014", "| clubs2 = → [[Feyenoord]] (loan)",
      "| years3 = ?", "| clubs3 = [[PSV Eindhoven|PSV]]",
    ])));
    expect(spells.map(spellText)).toEqual(["Ajax 2010–2012", "Feyenoord 2013–2014 (loan)"]);
    expect(review).toHaveLength(2);
    expect(review[0]).toMatch(/PSV/);
    expect(review[1]).toMatch(/Feyenoord loan .* outside the Ajax spell/);
  });

  it("flags overlapping loans and leaves the parent whole", () => {
    const { spells, review } = buildTargetHistory(career(infobox([
      "| years1 = 2010–2015", "| clubs1 = [[Ajax]]",
      "| years2 = 2011–2013", "| clubs2 = → [[Feyenoord]] (loan)",
      "| years3 = 2012–2014", "| clubs3 = → [[PSV Eindhoven|PSV]] (loan)",
    ])));
    expect(spells.map(spellText)).toEqual(["Ajax 2010–2015", "Feyenoord 2011–2013 (loan)", "PSV 2012–2014 (loan)"]);
    expect(review[0]).toMatch(/overlap/);
  });
});

describe("resolveClub", () => {
  const rows = [row(1, "tm_46", "Inter Milan", "2010", "2015"), row(2, "tm_5", "AC Milan", "2001", "2011")];

  it("matches through link targets and name normalisation", () => {
    expect(resolveClub(["Milan", "A.C. Milan"], rows)?.club_id).toBe("tm_5");
    expect(resolveClub(["Inter"], rows)?.club_id).toBe("tm_46");
  });

  it("uses search candidates for clubs not in the player's history, preferring the exact name", () => {
    const candidates = [
      { club_id: "133807", club_name: "Fenerbahce", badge: "" },
      { club_id: "tm_36", club_name: "Fenerbahçe", badge: "" },
      { club_id: "tm_7804", club_name: "Fenerbahce U21", badge: "" },
    ];
    expect(resolveClub(["Fenerbahçe", "Fenerbahçe S.K."], rows, candidates)?.club_id).toBe("tm_36");
  });

  it("treats same-named duplicate clubs as one club", () => {
    const dupes = [row(1, "133612", "Manchester United", "2026", ""), row(2, "tm_985", "Manchester United", "2016", "2025")];
    expect(resolveClub(["Manchester United"], dupes)).toMatchObject({ club_id: "tm_985", ids: ["133612", "tm_985"] });
  });

  it("returns null for no match or an ambiguous one", () => {
    expect(resolveClub(["Reggina"], rows)).toBeNull();
    const ambiguous = [{ club_id: "a", club_name: "Sporting CP", badge: "" }, { club_id: "b", club_name: "Sporting Gijón", badge: "" }];
    expect(resolveClub(["Sporting"], [], ambiguous)).toBeNull();
  });

  it("lists the names to search the clubs table for", () => {
    expect(unresolvedClubNames(career(lukakuWikitext), LUKAKU_ROWS)).toEqual(["Fenerbahçe"]);
  });
});

describe("planCleanup", () => {
  it("splits one long parent spell into spells around the loan, in order", () => {
    const rows = [row(1, "tm_46", "Inter Milan", "2010", "2015"), row(2, "tm_506", "Juventus FC", "2012", "2013")];
    const c = career(infobox([
      "| years1 = 2010–2015", "| clubs1 = [[Inter Milan|Inter]]",
      "| years2 = 2012–2013", "| clubs2 = → [[Juventus FC|Juventus]] (loan)",
    ]));
    const plan = planCleanup({ rows, career: c, currentYear: 2026 });
    expect(plan.proposed.map((p) => [p.club_name, p.year_joined, p.year_departed, p.is_loan, p.is_hidden])).toEqual([
      ["Inter Milan", "2010", "2012", false, false],
      ["Juventus FC", "2012", "2013", true, false],
      ["Inter Milan", "2013", "2015", false, false],
    ]);
    expect(plan.changes.map((ch) => ch.id)).toEqual(["update-1", "update-2", "insert-2"]);
    expect(plan.changes[1].reasons).toEqual(["Mark as loan"]);
    expect(plan.changes[2].reasons).toEqual(["Inter spell split around loan"]);
    expect(plan.review).toEqual([]);
  });

  it("cleans Lukaku's real history: loan splits, youth teams, current club", () => {
    const plan = planCleanup({ rows: LUKAKU_ROWS, career: career(lukakuWikitext), currentYear: 2026 });
    expect(plan.proposed.map((p) => `${p.key} ${p.club_name} ${p.year_joined}–${p.year_departed}${p.is_loan ? " L" : ""}${p.is_hidden ? " H" : ""}`)).toEqual([
      "1 Lierse SK Yth. –2006 H",
      "2 Anderlecht Yth. 2006–2008 H",
      "3 Anderlecht U17 2008–2009 H",
      "4 RSC Anderlecht 2009–2011",
      "5 Chelsea FC 2011–2012",
      "6 West Bromwich Albion 2012–2013 L",
      "7 Everton FC 2013–2014 L",
      "8 Everton FC 2014–2017",
      "9 Manchester United 2017–2019",
      "11 Inter Milan 2019–2021",
      "10 Chelsea FC 2021–2022",
      "new-8 Inter Milan 2022–2023 L",
      "12 AS Roma 2023–2024 L",
      "13 Napoli 2024–2026",
    ]);
    const byId = new Map(plan.changes.map((ch) => [ch.id, ch.reasons]));
    expect(byId.get("update-5")).toEqual(["Years 2011–2024 → 2011–2012 (split around loan)"]);
    expect(byId.get("update-11")).toEqual(["Years 2019–2023 → 2019–2021", "Not a loan"]);
    expect(byId.get("update-1")).toEqual(["Youth/reserve team name"]);
    expect(byId.get("insert-8")).toEqual(["Loan missing from our history"]);
    expect(plan.changes.map((ch) => ch.id)).toEqual([
      "update-1", "update-2", "update-3", "update-5", "update-11", "update-10", "insert-8", "update-13", "reorder",
    ]);
    expect(plan.review).toEqual([expect.stringMatching(/^Fenerbahçe \(2026–present\) .* add it by hand/)]);
    expect(plan.currentClubNote).toMatch(/Fenerbahçe, doesn't match/);
  });

  it("inserts a recent transfer once the club is found in the clubs table", () => {
    const plan = planCleanup({
      rows: LUKAKU_ROWS,
      career: career(lukakuWikitext),
      candidates: [{ club_id: "tm_36", club_name: "Fenerbahçe", badge: "" }],
      currentYear: 2026,
    });
    const last = plan.proposed[plan.proposed.length - 1];
    expect(last).toMatchObject({ rowId: null, club_id: "tm_36", year_joined: "2026", year_departed: "" });
    expect(plan.review).toEqual([]);
    expect(plan.currentClubNote).toBe("Current club: we have Napoli, Wikipedia says Fenerbahçe.");
  });

  it("hides a first-team row that Wikipedia lists as a youth spell", () => {
    const rows = [row(1, "tm_58", "RSC Anderlecht", "2006", "2008"), row(2, "tm_58", "RSC Anderlecht", "2009", "2011")];
    const c = career(infobox([
      "| youthyears1 = 2006–2009", "| youthclubs1 = [[R.S.C. Anderlecht|Anderlecht]]",
      "| years1 = 2009–2011", "| clubs1 = [[R.S.C. Anderlecht|Anderlecht]]",
    ]));
    const plan = planCleanup({ rows, career: c, currentYear: 2026 });
    expect(plan.changes).toEqual([
      expect.objectContaining({ id: "update-1", reasons: ["Youth club on Wikipedia"], after: expect.objectContaining({ is_youth_team: true, is_hidden: true }) }),
    ]);
  });

  it("flags rows Wikipedia doesn't list instead of deleting them", () => {
    const rows = [row(1, "tm_1", "Ajax", "2010", "2012"), row(2, "tm_2", "Some Club", "2012", "2013")];
    const c = career(infobox(["| years1 = 2010–2012", "| clubs1 = [[AFC Ajax|Ajax]]"]));
    const plan = planCleanup({ rows, career: c, currentYear: 2026 });
    expect(plan.changes).toEqual([]);
    expect(plan.review).toEqual(["Some Club (2012–2013) isn't in the Wikipedia infobox — check it or delete it by hand."]);
  });

  it("has nothing to change when the history already matches", () => {
    const rows = [
      row(1, "tm_985", "Manchester United", "2015", "2025"),
      row(2, "tm_405", "Aston Villa", "2025", "2025", { is_loan: true }),
      row(3, "tm_131", "FC Barcelona", "2025", "2026", { is_loan: true }),
      row(4, "tm_985", "Manchester United", "2026", ""),
    ];
    const plan = planCleanup({ rows, career: career(rashfordWikitext), currentYear: 2026 });
    expect(plan.changes).toEqual([]);
    expect(plan.review).toEqual([]);
    expect(plan.currentClubNote).toBeNull();
  });

  it("flags a page without an infobox for manual review", () => {
    const rows = [row(1, "tm_1", "Ajax", "2010", "2012")];
    const plan = planCleanup({ rows, career: null, currentYear: 2026 });
    expect(plan.changes).toEqual([]);
    expect(plan.review[0]).toMatch(/no football infobox/);
  });

  it("notes a retired player we still have at a club", () => {
    const rows = [row(1, "tm_38979", "New York City FC", "2015", "")];
    const plan = planCleanup({ rows, career: career(pirloWikitext), currentYear: 2026 });
    expect(plan.currentClubNote).toMatch(/Wikipedia lists no current club/);
  });
});

describe("finalOrder", () => {
  const rows = [row(1, "tm_506", "Juventus FC", "2012", "2013"), row(2, "tm_46", "Inter Milan", "2010", "2015")];
  const plan = planCleanup({
    rows,
    career: career(infobox([
      "| years1 = 2010–2015", "| clubs1 = [[Inter Milan|Inter]]",
      "| years2 = 2012–2013", "| clubs2 = → [[Juventus FC|Juventus]] (loan)",
    ])),
    currentYear: 2026,
  });

  it("uses the suggested order when everything is accepted", () => {
    const all = new Set(plan.changes.map((ch) => ch.id));
    expect(finalOrder(plan, rows, all).map((p) => p.key)).toEqual(["2", "1", "new-2"]);
  });

  it("keeps the current order of existing rows when the reorder is skipped", () => {
    expect(finalOrder(plan, rows, new Set(["insert-2"])).map((p) => p.key)).toEqual(["1", "2", "new-2"]);
  });

  it("drops skipped inserts", () => {
    expect(finalOrder(plan, rows, new Set(["reorder"])).map((p) => p.key)).toEqual(["2", "1"]);
  });
});
