# Football Nerdle

A football (soccer) trivia web app with multiple game modes, deployed to GitHub Pages.

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build**: Vite 8
- **Styling**: Tailwind CSS 4 (via `@tailwindcss/vite` plugin)
- **Routing**: React Router DOM 7 (HashRouter for GitHub Pages compatibility)
- **Backend**: Supabase (Postgres + Realtime + Auth) — player data, multiplayer rooms, admin auth
- **Data Source**: [TransferMarkt datasets](https://github.com/dcaribou/transfermarkt-datasets) — ~47k players imported via scripts
- **Deployment**: GitHub Pages at `https://spiritsack.github.io/football-nerdle/`

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key (or `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for import scripts only (never in browser) |

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Type-check (`tsc -b`) then build with Vite
- `npm run lint` — ESLint
- `npm run preview` — Preview production build
- `npm test` — Unit tests (Vitest)
- `npm run test:e2e` — E2E tests (Playwright)
- `npx tsx scripts/import-transfermarkt.ts` — Import target league players
- `npx tsx scripts/import-transfermarkt.ts --all` — Import all players from dataset

## Project Structure

```
src/
  main.tsx              — Entry point
  App.tsx               — Routes: /, /battle, /guess, /guess/archive, /battle/multiplayer, /admin
  types.ts              — Shared types: Player, FormerTeam, PlayerWithTeams, GameRoom
  constants.ts          — Shared constants (TURN_TIME)
  index.css             — Global styles (Tailwind imports)
  api/
    supabaseClient.ts   — Supabase client singleton
    playerCache.ts      — Player data queries: search, lookup, random selection
    dailySchedule.ts    — Daily player selection (Supabase daily_schedule table)
    multiplayerRoom.ts  — Room CRUD: createRoom, joinRoom, updateTurn, subscribeToRoom
    adminApi.ts         — Admin write operations: schedule, clubs, crests, player lookup
    useAdminAuth.ts     — Supabase Auth hook for admin sign-in/sign-out
  pages/
    Home/               — Landing page with game mode selection
      index.tsx
    Battle/             — Single-player Battle Mode
      index.tsx, types.ts, constants.ts, helpers.ts, useGame.ts
    GuessThePlayer/     — Guess the Player game
      index.tsx, types.ts, constants.ts, helpers.ts, useGuessGame.ts
      Archive/          — Archive page (past daily puzzles)
    MultiplayerBattle/  — Online multiplayer Battle Mode
      index.tsx, types.ts, constants.ts, helpers.ts
      useMultiplayerRoom.ts, useMultiplayerGame.ts
      MultiplayerGame/  — In-game component
        index.tsx
    Admin/              — Admin interface (auth-protected)
      index.tsx, types.ts, constants.ts
      ScheduleManager.tsx — Daily schedule curation with search
      PlayerClubList.tsx  — Club history editor (reorder, hide, loan/youth flags, crests)
      CrestDropZone.tsx   — Drag-and-drop crest upload
  components/
    PlayerSearch/       — Reusable player autocomplete (searches Supabase)
      index.tsx, types.ts
    PlayerCard/         — Player card with club history, hints, and guess input
      index.tsx, types.ts
  utils/
    gameLogic.ts        — didPlayTogether (pure function), ApiError
    dates.ts            — Shared date formatting (getTodayString)
    clubNames.ts        — Club name normalization
  data/
    seedPlayers.ts      — 107 seed players for daily puzzle (TransferMarkt IDs)
scripts/
  import-transfermarkt.ts — Import players/transfers from TransferMarkt CSVs (--all for full dataset)
  seed-players.ts         — Pre-populate players from top clubs
supabase/
  migrations/           — SQL migration files for Supabase schema
e2e/                    — Playwright E2E tests
```

## Architecture

- **Player data**: All player data lives in Supabase, imported from TransferMarkt datasets (~47k players). No runtime API calls to external services. Player search queries the Supabase `players` table directly.
- **Admin authentication**: Supabase Auth (email/password) protects the admin interface. An `admin_users` table stores allowed emails. The `is_admin()` SQL function checks the JWT against this table. No service role key in client code.
- **RLS policies**: Data tables allow SELECT for anyone, INSERT/UPDATE restricted to admin users. `daily_schedule` allows anon INSERT (game auto-creates daily entries). `game_rooms` allows full anon access (multiplayer).
- **`didPlayTogether`**: Pure function in `utils/gameLogic.ts` — checks if two players overlapped at the same club. No API calls.
- **Multiplayer**: Supabase Realtime (Postgres Changes) syncs game room state between two clients. The `game_rooms` DB row is the single source of truth. Optimistic locking on `current_turn` prevents race conditions.

## Supabase Schema

| Table | Purpose | RLS |
|-------|---------|-----|
| `countries` | Country names | Read: anyone, Write: admin |
| `clubs` | Club data with badges, league, country | Read: anyone, Write: admin |
| `players` | Player identity, nationality, thumbnail | Read: anyone, Write: admin |
| `player_clubs` | Player club history (joined/departed, loan/youth flags) | Read: anyone, Write: admin |
| `game_rooms` | Multiplayer game state | Read + Write: anyone |
| `pool_refresh` | Tracks daily pool refresh | Read: anyone, Write: admin |
| `daily_schedule` | Daily player selection (one per day) | Read + Insert: anyone, Update + Delete: admin |
| `admin_users` | Allowed admin emails | Read: admin only |

## Git Workflow

- **Never push directly to main** — all changes go through feature branches and pull requests
- Branch naming: `feat/description`, `fix/description`, `refactor/description`, `docs/description`
- **Conventional commits**: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- CI runs type check, lint, unit tests (Vitest), and E2E tests (Playwright) on PRs
- Deploy workflow only triggers for app code changes (skips docs, tests, scripts, config)
- Main branch auto-deploys to GitHub Pages on merge

## Testing

- **Unit tests**: `npm test` — Vitest, files in `src/__tests__/`
- **E2E tests**: `npm run test:e2e` — Playwright, files in `e2e/`
- Changes that affect behavior must include test updates
- E2E tests use real Supabase data

## Conventions

- All components are function components with default exports
- Each page/component gets its own folder with `index.tsx`, `types.ts`, and optionally `helpers.ts`, `constants.ts`
- Page-specific hooks live alongside their page (e.g. `pages/Battle/useGame.ts`)
- Shared types/constants live at `src/types.ts` and `src/constants.ts`
- No state management library; hooks + useState
- Tailwind utility classes inline, dark theme (gray-900 bg)

## Game-specific docs

- [src/pages/Battle/CLAUDE.md](src/pages/Battle/CLAUDE.md) — Battle Mode details
- [src/pages/GuessThePlayer/CLAUDE.md](src/pages/GuessThePlayer/CLAUDE.md) — Guess the Player details
- [src/pages/MultiplayerBattle/CLAUDE.md](src/pages/MultiplayerBattle/CLAUDE.md) — Multiplayer Battle details
