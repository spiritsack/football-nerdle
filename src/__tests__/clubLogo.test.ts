import { describe, it, expect } from "vitest";
import {
  checkCrestImage,
  clubNameKey,
  extensionForMime,
  isDuplicateClub,
  isSameClubName,
  lookupKeyForClub,
  pickArticle,
} from "../pages/Admin/clubLogo";
import type { ArticleCandidate } from "../pages/Admin/clubLogo";

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
