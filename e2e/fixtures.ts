import type { Page } from "@playwright/test";

// Mock TheSportsDB search responses
const MOCK_SEARCH_RESPONSES: Record<string, unknown> = {
  messi: {
    player: [
      {
        idPlayer: "34146370",
        strPlayer: "Lionel Messi",
        strThumb: "https://r2.thesportsdb.com/images/media/player/thumb/kpfsvp1725295651.jpg",
        strNationality: "Argentina",
        strSport: "Soccer",
        idTeam: "137699",
        strTeam: "Inter Miami",
        dateSigned: null,
      },
    ],
  },
  ronaldo: {
    player: [
      {
        idPlayer: "34146304",
        strPlayer: "Cristiano Ronaldo",
        strThumb: "https://r2.thesportsdb.com/images/media/player/thumb/bkre241600892282.jpg",
        strNationality: "Portugal",
        strSport: "Soccer",
        idTeam: "134509",
        strTeam: "Al-Nassr",
        dateSigned: null,
      },
    ],
  },
  neymar: {
    player: [
      {
        idPlayer: "34146371",
        strPlayer: "Neymar",
        strThumb: "https://r2.thesportsdb.com/images/media/player/thumb/j60pdx1741319053.jpg",
        strNationality: "Brazil",
        strSport: "Soccer",
        idTeam: null,
        strTeam: null,
        dateSigned: null,
      },
    ],
  },
};

export async function mockTheSportsDB(page: Page) {
  await page.route("**/thesportsdb.com/**", (route) => {
    const url = route.request().url();

    // Mock search endpoint
    if (url.includes("searchplayers.php")) {
      const match = url.match(/p=([^&]+)/);
      const query = match ? decodeURIComponent(match[1]).toLowerCase() : "";

      for (const [key, response] of Object.entries(MOCK_SEARCH_RESPONSES)) {
        if (query.includes(key)) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(response),
          });
        }
      }

      // No match — return empty
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ player: null }),
      });
    }

    // Let other TheSportsDB requests through (former teams, player lookup)
    return route.continue();
  });
}
