# Football Nerdle

A football (soccer) trivia web app with two game modes, deployed to GitHub Pages.

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build**: Vite 8
- **Styling**: Tailwind CSS 4 (via `@tailwindcss/vite` plugin)
- **Routing**: React Router DOM 7 (HashRouter for GitHub Pages compatibility)
- **API**: TheSportsDB (`VITE_SPORTSDB_API_KEY` env var, defaults to free key `"3"`)
- **Backend**: Supabase (Postgres + Realtime) — player data cache + multiplayer game rooms
- **Deployment**: GitHub Pages at `https://spiritsack.github.io/football-nerdle/`

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_SPORTSDB_API_KEY` | TheSportsDB API key (defaults to `"3"`) |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |

## Commands

- `npm run dev` — Start dev server
- `npm run build` — Type-check (`tsc -b`) then build with Vite
- `npm run lint` — ESLint
- `npm run preview` — Preview production build

## Project Structure

```
src/
  main.tsx              — Entry point
  App.tsx               — Routes: /, /battle, /guess, /battle/multiplayer
  types.ts              — Shared types: Player, FormerTeam, PlayerWithTeams, GameRoom
  constants.ts          — Shared constants (TURN_TIME)
  index.css             — Global styles (Tailwind imports)
  api/
    sportsdb.ts         — TheSportsDB API client (search, former teams, overlap check)
    supabaseClient.ts   — Supabase client singleton
    playerCache.ts      — Cache-through wrapper: Supabase first, fallback to TheSportsDB
    multiplayerRoom.ts  — Room CRUD: createRoom, joinRoom, updateTurn, subscribeToRoom
  pages/
    Home/               — Landing page
      index.tsx
    Battle/             — Single-player Battle Mode
      index.tsx, types.ts, constants.ts, helpers.ts, useGame.ts
    GuessThePlayer/     — Guess the Player game
      index.tsx, types.ts, constants.ts, helpers.ts, useGuessGame.ts
    MultiplayerBattle/  — Online multiplayer Battle Mode
      index.tsx, types.ts, constants.ts, helpers.ts
      useMultiplayerRoom.ts, useMultiplayerGame.ts
      MultiplayerGame/  — In-game component
        index.tsx
  components/
    PlayerSearch/       — Reusable player autocomplete search
      index.tsx, types.ts
  data/
    seedPlayers.ts      — 19 hardcoded seed players
scripts/
  seed-players.ts       — Pre-populate Supabase with seed player data
supabase/
  migrations/           — SQL migration files for Supabase schema
```

## Architecture

- **Player data caching**: `playerCache.ts` checks Supabase first, falls back to TheSportsDB, and caches the result. `searchPlayers` still hits TheSportsDB directly (free-text search can't be cached).
- **Multiplayer**: Supabase Realtime (Postgres Changes) syncs game room state between two clients. The `game_rooms` DB row is the single source of truth. Optimistic locking on `current_turn` prevents race conditions.

## Conventions

- All components are function components with default exports
- Each page/component gets its own folder with `index.tsx`, `types.ts`, and optionally `helpers.ts`, `constants.ts`
- Page-specific hooks live alongside their page (e.g. `pages/Battle/useGame.ts`)
- Shared types/constants live at `src/types.ts` and `src/constants.ts`
- API layer wraps TheSportsDB with typed responses and `ApiError` class
- No test framework configured
- No state management library; hooks + useState
- Tailwind utility classes inline, dark theme (gray-900 bg)

## Game-specific docs

- [src/pages/Battle/CLAUDE.md](src/pages/Battle/CLAUDE.md) — Battle Mode details
- [src/pages/GuessThePlayer/CLAUDE.md](src/pages/GuessThePlayer/CLAUDE.md) — Guess the Player details
- [src/pages/MultiplayerBattle/CLAUDE.md](src/pages/MultiplayerBattle/CLAUDE.md) — Multiplayer Battle details
