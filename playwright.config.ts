import { defineConfig } from "@playwright/test";

// E2E runs against a production build served by `vite preview`, not the dev
// server. The dev server renders the app in React StrictMode, which mounts
// twice, so every puzzle loaded twice and the late second load reset a game
// the test was already playing. A build also has no on-demand compile on the
// first request. Set E2E_PORT when another checkout already uses the port.
const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE_URL = `http://localhost:${PORT}/football-nerdle/`;

export default defineConfig({
  testDir: "./e2e",
  // Data waits use DATA_TIMEOUT (30s, e2e/fixtures.ts); leave room for a
  // test that loads more than one puzzle.
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: BASE_URL,
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    // Staging mode: the same database as `npm run dev`
    command: `npx vite build --mode staging && npx vite preview --mode staging --port ${PORT} --strictPort`,
    url: BASE_URL,
    // Never test against a server some other checkout left on the port
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
