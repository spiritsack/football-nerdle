import { describe, it, expect } from "vitest";
import {
  checkCrestImage,
  clubNameKey,
  extensionForMime,
  isDuplicateClub,
  isSameClubName,
  lookupKeyForClub,
  parentClubName,
  parentNameKey,
  parentNamePattern,
  pickArticle,
  pickParentClub,
} from "../pages/Admin/clubLogo";
import type { ArticleCandidate, ParentCandidate } from "../pages/Admin/clubLogo";

function article(title: string, description = "Association football club in England", qid: string | null = null): ArticleCandidate {
  return { title, description, qid };
}

describe("lookupKeyForClub", () => {
  it("uses the Wikidata item of a wd_ club", () => {
    expect(lookupKeyForClub("wd_Q922140")).toEqual({ kind: "wikidata", qid: "Q922140" });
  });

  it("uses the TransferMarkt id of a tm_ club", () => {
    expect(lookupKeyForClub("tm_985")).toEqual({ kind: "transfermarkt", transfermarktId: "985" });
  });

  it("uses the transfermarkt_id column when the id has no prefix", () => {
    expect(lookupKeyForClub("133612", "985")).toEqual({ kind: "transfermarkt", transfermarktId: "985" });
  });

  it("falls back to a name search for sportsdb ids", () => {
    expect(lookupKeyForClub("133612")).toEqual({ kind: "name" });
    expect(lookupKeyForClub("133612", null)).toEqual({ kind: "name" });
  });
});

describe("clubNameKey", () => {
  it("ignores abbreviations, dots, accents and disambiguation", () => {
    expect(clubNameKey("Manchester United F.C.")).toBe("manchester united");
    expect(clubNameKey("FC Etzella Ettelbruck")).toBe("etzella ettelbruck");
    expect(clubNameKey("Atlético Madrid")).toBe("atletico madrid");
    expect(clubNameKey("Toulouse FC (1937–67)")).toBe("toulouse");
  });
});

describe("isSameClubName", () => {
  it("treats a sportsdb/tm_ duplicate pair as one name", () => {
    expect(isSameClubName("Manchester United", "Manchester United")).toBe(true);
    expect(isSameClubName("Liverpool F.C.", "Liverpool FC")).toBe(true);
  });

  it("keeps reserve teams apart from the first team", () => {
    expect(isSameClubName("Manchester United", "Manchester United F.C. Reserves and Academy")).toBe(false);
  });
});

describe("isDuplicateClub", () => {
  it("pairs a sportsdb club with the tm_ club of the same name", () => {
    expect(isDuplicateClub({ id: "133612", name: "Manchester United" }, { id: "tm_985", name: "Manchester United" })).toBe(true);
  });

  it("does not pair two TransferMarkt clubs that share a name", () => {
    expect(isDuplicateClub({ id: "tm_10247", name: "Portuguesa" }, { id: "tm_15883", name: "Portuguesa" })).toBe(false);
  });

  it("does not pair differently named clubs or a club with itself", () => {
    expect(isDuplicateClub({ id: "133612", name: "Manchester United" }, { id: "tm_986", name: "Manchester City" })).toBe(false);
    expect(isDuplicateClub({ id: "tm_985", name: "Manchester United" }, { id: "tm_985", name: "Manchester United" })).toBe(false);
  });
});

describe("pickArticle", () => {
  it("matches the one football club article with the club's name", () => {
    const pick = pickArticle("Manchester United", [
      article("Manchester United F.C."),
      article("Manchester United W.F.C.", "Women's association football club in England"),
      article("History of Manchester United F.C.", "Aspect of history"),
    ]);
    expect(pick).toEqual({ kind: "match", article: article("Manchester United F.C.") });
  });

  it("is ambiguous when several football clubs fit a short name", () => {
    const pick = pickArticle("Coventry", [
      article("Coventry City F.C."),
      article("Coventry United F.C."),
    ]);
    expect(pick.kind).toBe("ambiguous");
    if (pick.kind === "ambiguous") {
      expect(pick.candidates.map((c) => c.title)).toEqual(["Coventry City F.C.", "Coventry United F.C."]);
    }
  });

  it("is ambiguous when two clubs share the exact name", () => {
    const pick = pickArticle("Toulouse FC", [
      article("Toulouse FC", "Association football club in France"),
      article("Toulouse FC (1937–67)", "Defunct French football club"),
    ]);
    expect(pick).toEqual({
      kind: "ambiguous",
      candidates: [
        article("Toulouse FC", "Association football club in France"),
        article("Toulouse FC (1937–67)", "Defunct French football club"),
      ],
    });
  });

  it("does not take a single non-matching club as a match", () => {
    expect(pickArticle("Angers For.", [article("Angers SCO", "French football club")]).kind).toBe("ambiguous");
  });

  it("ignores season articles and articles that aren't football clubs", () => {
    expect(pickArticle("Lens Yth.", [
      article("2015–16 Watford F.C. season", "Watford football club 2015–16 season"),
      article("Lens", "Optical device"),
    ])).toEqual({ kind: "none" });
  });

  it("finds nothing in an empty search", () => {
    expect(pickArticle("Derby U18", [])).toEqual({ kind: "none" });
  });
});

describe("checkCrestImage", () => {
  it("accepts a non-free enwiki crest by its categories", () => {
    expect(checkCrestImage({
      file: "Arsenal FC.svg",
      mime: "image/svg+xml",
      description: "",
      categories: "Arsenal F.C.|English football logos|All non-free logos|All non-free media",
    }, "Arsenal")).toEqual({ ok: true });
  });

  it("accepts a file named as a logo", () => {
    expect(checkCrestImage({
      file: "FC_Etzella_Ettelbruck_logo.svg",
      mime: "image/svg+xml",
      description: "",
      categories: "",
    }, "FC Etzella Ettelbruck")).toEqual({ ok: true });
  });

  it("accepts a German Wappen description", () => {
    expect(checkCrestImage({
      file: "TSV 1860 Rosenheim.svg",
      mime: "image/svg+xml",
      description: "Vereinswappen des TSV 1860 Rosenheim",
      categories: "",
    }, "TSV 1860 Rosenheim").ok).toBe(true);
  });

  it("rejects a stadium photo", () => {
    expect(checkCrestImage({
      file: "Stade am Deich II (14).jpg",
      mime: "image/jpeg",
      description: "Stade am Deich, behind goal",
      categories: "August 2021 Luxembourg photographs|Self-published work|Stade Am Deich",
    }, "FC Etzella Ettelbruck")).toEqual({ ok: false, reason: "Stade am Deich II (14).jpg looks like a photo, not a crest" });
  });

  it("rejects a stadium photo even when its categories mention the club's logo", () => {
    expect(checkCrestImage({
      file: "Anfield_stadium_2019.jpg",
      mime: "image/jpeg",
      description: "Anfield stadium",
      categories: "Liverpool F.C. logos",
    }, "Liverpool").ok).toBe(false);
  });

  it("trusts a Wikidata logo without a crest hint", () => {
    expect(checkCrestImage({ file: "Team 1998.png", mime: "image/png", description: "", categories: "" }, "Some FC", true)).toEqual({ ok: true });
  });

  it("rejects a Wikidata logo that is a photo of the crest", () => {
    expect(checkCrestImage({
      file: "Arsenal ČL3 (cropped).JPG",
      mime: "image/jpeg",
      description: "Znak fotbalistů na jedné z budov u hřiště",
      categories: "Association football logos of the Czech Republic|Czech Republic photographs taken on 2013-01-15",
    }, "Arsenal Česká Lípa", true).ok).toBe(false);
  });

  it("does not mistake a club name for a photo hint", () => {
    expect(checkCrestImage({
      file: "FC Pinatar Arena logo.png",
      mime: "image/png",
      description: "",
      categories: "",
    }, "FC Pinatar Arena")).toEqual({ ok: true });
  });

  it("rejects an image with no crest hint", () => {
    expect(checkCrestImage({
      file: "Team 1998.png",
      mime: "image/png",
      description: "",
      categories: "",
    }, "Some FC")).toEqual({ ok: false, reason: "Team 1998.png has no logo or crest hint" });
  });
});

describe("extensionForMime", () => {
  it("maps image types to storage extensions", () => {
    expect(extensionForMime("image/png")).toBe("png");
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("image/svg+xml; charset=utf-8")).toBe("svg");
  });

  it("rejects anything else", () => {
    expect(extensionForMime("text/html")).toBeNull();
    expect(extensionForMime("")).toBeNull();
  });
});

describe("parentClubName", () => {
  it("strips TransferMarkt youth and reserve suffixes", () => {
    expect(parentClubName("Derby U18")).toBe("Derby");
    expect(parentClubName("Lens Yth.")).toBe("Lens");
    expect(parentClubName("Malmö FF Jgd.")).toBe("Malmö FF");
    expect(parentClubName("Hannover 96 II")).toBe("Hannover 96");
    expect(parentClubName("Barcelona B")).toBe("Barcelona");
    expect(parentClubName("Sevilla FC C")).toBe("Sevilla FC");
    expect(parentClubName("Wolves U21")).toBe("Wolves");
    expect(parentClubName("Juventus U23")).toBe("Juventus");
    expect(parentClubName("Portland Timbers Reserves")).toBe("Portland Timbers");
    expect(parentClubName("Toulouse For.")).toBe("Toulouse");
    expect(parentClubName("Montpellier For")).toBe("Montpellier");
    expect(parentClubName("CF Benfica S15")).toBe("CF Benfica");
    expect(parentClubName("Tondela Sub-17")).toBe("Tondela");
    expect(parentClubName("Dynamo 2 ")).toBe("Dynamo");
  });

  it("leaves first teams alone", () => {
    expect(parentClubName("Derby County")).toBeNull();
    expect(parentClubName("Hannover 96")).toBeNull();
    expect(parentClubName("Boca Juniors")).toBeNull();
    expect(parentClubName("Bayern Munich")).toBeNull();
  });

  it("strips a suffix that is also part of a first team's name, for the parent lookup to reject", () => {
    expect(parentClubName("Willem II")).toBe("Willem");
  });
});

describe("parentNameKey", () => {
  it("ignores case, accents and punctuation", () => {
    expect(parentNameKey("SönderjyskE")).toBe(parentNameKey("Sonderjyske"));
    expect(parentNameKey("Al-Ahly")).toBe(parentNameKey("Al Ahly"));
    expect(parentNameKey("Paris F.C.")).toBe(parentNameKey("Paris Football Club"));
  });

  it("keeps prefixes, so CF Benfica is not Benfica", () => {
    expect(parentNameKey("CF Benfica")).not.toBe(parentNameKey("Benfica"));
  });
});

describe("parentNamePattern", () => {
  it("matches accented and punctuated spellings of the same name", () => {
    const like = (pattern: string, name: string) =>
      new RegExp(`^${pattern.replace(/_/g, ".")}$`, "iu").test(name);
    expect(like(parentNamePattern("Concordia"), "Concórdia")).toBe(true);
    expect(like(parentNamePattern("Al Ahly"), "Al-Ahly")).toBe(true);
    expect(parentNamePattern("50% off")).not.toContain("%");
  });
});

describe("pickParentClub", () => {
  const club = (id: string, name: string, badge = ""): ParentCandidate => ({ id, name, badge });
  const derbyU18 = { id: "tm_9999", name: "Derby U18" };

  it("matches a single club with the parent's name", () => {
    const derby = club("133627", "Derby", "https://example.com/derby.png");
    expect(pickParentClub(derbyU18, [derby, club("tm_1", "Derby County")])).toEqual({ kind: "match", parent: derby });
  });

  it("matches a parent without a badge, for the Wikipedia lookup", () => {
    const kalmar = club("tm_3654", "Kalmar FF");
    expect(pickParentClub({ id: "tm_1", name: "Kalmar FF Jgd." }, [kalmar])).toEqual({ kind: "match", parent: kalmar });
  });

  it("matches across accents and case", () => {
    const sonderjyske = club("tm_5817", "SönderjyskE", "b.png");
    expect(pickParentClub({ id: "tm_1", name: "Sönderjyske U19" }, [sonderjyske])).toEqual({ kind: "match", parent: sonderjyske });
  });

  it("treats one club imported from two sources as one parent, preferring the copy with a badge", () => {
    const sportsdb = club("134011", "AIK");
    const tm = club("tm_272", "AIK", "aik.png");
    expect(pickParentClub({ id: "tm_1", name: "AIK Yth." }, [sportsdb, tm])).toEqual({ kind: "match", parent: tm });
  });

  it("prefers the tm_/wd_ copy when neither has a badge", () => {
    const sportsdb = club("134011", "AIK");
    const wd = club("wd_Q1", "AIK");
    expect(pickParentClub({ id: "tm_1", name: "AIK U19" }, [sportsdb, wd])).toEqual({ kind: "match", parent: wd });
  });

  it("treats same-named clubs with the same badge as one parent", () => {
    const a = club("tm_1", "Atlas", "atlas.png");
    const b = club("tm_2", "Atlas", "atlas.png");
    expect(pickParentClub({ id: "tm_3", name: "Atlas U20" }, [a, b]).kind).toBe("match");
  });

  it("is ambiguous for two TransferMarkt clubs with the parent's name", () => {
    const rangers = [club("tm_124", "Rangers", "a.png"), club("tm_2930", "Rangers", "b.png")];
    expect(pickParentClub({ id: "tm_1", name: "Rangers B" }, rangers)).toEqual({ kind: "ambiguous", candidates: rangers });
  });

  it("is ambiguous when the same name differs only by accents", () => {
    const concordia = [club("tm_15945", "Concordia", "a.png"), club("tm_31534", "Concórdia", "b.png")];
    expect(pickParentClub({ id: "tm_1", name: "Concordia U17" }, concordia).kind).toBe("ambiguous");
  });

  it("is ambiguous when one of two same-named clubs has no badge", () => {
    const bohemians = [club("tm_37350", "Bohemians", "a.png"), club("tm_9211", "Bohemians")];
    expect(pickParentClub({ id: "tm_1", name: "Bohemians Yth." }, bohemians).kind).toBe("ambiguous");
  });

  it("finds no parent when no club has the name, or the name is the club itself", () => {
    expect(pickParentClub(derbyU18, [club("tm_1", "Derby County")])).toEqual({ kind: "none" });
    expect(pickParentClub({ id: "tm_1", name: "Willem II" }, [club("tm_1", "Willem II")])).toEqual({ kind: "none" });
    expect(pickParentClub({ id: "tm_1", name: "Bayern Munich" }, [club("tm_2", "Bayern Munich")])).toEqual({ kind: "none" });
  });

  it("can't tell the parent apart when another club has the youth team's own name", () => {
    const redStarU19 = { id: "tm_11137", name: "Red Star U19" };
    const twin = club("tm_16193", "Red Star U19");
    expect(pickParentClub(redStarU19, [club("tm_19598", "Red Star", "r.png"), twin, club(redStarU19.id, redStarU19.name)]))
      .toEqual({ kind: "same-name", others: [twin] });
  });

  it("still matches when the youth team's namesake is the same club from another source", () => {
    const derby = club("133627", "Derby", "d.png");
    expect(pickParentClub(derbyU18, [derby, club("134000", "Derby U18")])).toEqual({ kind: "match", parent: derby });
  });

  it("does not match CF Benfica's youth team to Benfica", () => {
    expect(pickParentClub({ id: "tm_1", name: "CF Benfica S15" }, [club("tm_294", "Benfica", "b.png")])).toEqual({ kind: "none" });
  });
});
