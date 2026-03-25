# Battle Mode

## Single-player

Route: `/battle` — Component: `Game.tsx` — Hook: `../hooks/useGame.ts`

### How It Works

1. Player clicks Start, a random seed player is loaded from `seedPlayers.ts`
2. Player must name footballers who played at the same club (with overlapping years) as the current player
3. 15-second timer per turn; each correct answer extends the chain
4. Game ends on wrong answer, timeout, or API error

### State Machine

`idle` → `loading` → `playing` ↔ `checking` → `gameover`

- `playing`: timer running, search enabled
- `checking`: API call in progress after player selection, timer paused
- `gameover`: wrong answer, timeout, or unrecoverable error

### Key Logic (`useGame.ts`)

- `startGame()` — picks random seed, fetches teams via `getPlayerWithTeamsCached`, starts timer
- `submitPlayer(player)` — fetches teams, calls `didPlayTogether()` from `sportsdb.ts`
- `didPlayTogether(a, b)` — checks for shared club with overlapping year ranges
- Tracks `usedPlayerIds` to prevent repeats within a game
- Timer uses `setInterval` with cleanup on unmount

### localStorage

| Key | Stores |
|-----|--------|
| `football-nerdle-best-streak` | Best chain score (number) |

---

## Multiplayer

Route: `/battle/multiplayer` — Components: `MultiplayerLobby.tsx`, `MultiplayerGame.tsx` — Hooks: `../hooks/useMultiplayerRoom.ts`, `../hooks/useMultiplayerGame.ts`

### How It Works

1. Host creates a room, gets a 6-character code to share
2. Guest joins by entering the code (or via shared link `/#/battle/multiplayer?code=ABC123`)
3. Host starts the game with a random seed player
4. Players take turns naming players who played together (same chain mechanic as single-player)
5. 15-second timer per turn; game ends when a player picks wrong or times out — the other wins

### Room Lifecycle

`waiting` (host created, waiting for guest) → `playing` (both connected, taking turns) → `finished` (someone won/lost)

### Real-time Sync

- Uses Supabase Realtime (Postgres Changes) on the `game_rooms` row
- The DB row is the single source of truth — both clients subscribe and re-render on updates
- Turn updates use optimistic locking: `.eq('current_turn', myId)` ensures only the active player's write succeeds

### Timer

- `turn_started_at` stored in DB for server-authoritative reference
- Each client runs a local 15-second countdown for display
- When timer hits 0, client updates room to `finished` (both clients may try — same outcome)

### Supabase Tables

| Table | Purpose |
|-------|---------|
| `game_rooms` | Room state: players, chain, turns, status, winner |
| `players` | Cached player identity (shared with single-player caching) |
| `player_teams` | Cached team history per player (shared with single-player caching) |
