# Multiplayer Battle

Route: `/battle/multiplayer` — Page: `index.tsx` (lobby) + `MultiplayerGame/index.tsx` (game)

## How It Works

1. Host creates a room, gets a 6-character code to share
2. Guest joins by entering the code or via invite link
3. Host starts the game with a random seed player
4. Players take turns naming players who played together
5. 15-second timer per turn; game ends on wrong answer or timeout

## File Structure

- `index.tsx` — Lobby page (create/join room)
- `MultiplayerGame/index.tsx` — In-game UI
- `useMultiplayerRoom.ts` — Hook: room creation, joining, reconnection
- `useMultiplayerGame.ts` — Hook: game state, Realtime subscription, turns, timer
- `types.ts` — LobbyStatus, LobbyState, StoredSession, MultiplayerGameStatus, etc.
- `constants.ts` — SESSION_KEY, heartbeat/disconnect constants
- `helpers.ts` — Session persistence (localStorage)

## Room Lifecycle

`waiting` → `playing` → `finished`

## Real-time Sync

Uses Supabase Realtime (Postgres Changes) + polling fallback.
Turn updates use optimistic locking via `current_turn` column.

## Supabase Tables

| Table | Purpose |
|-------|---------|
| `game_rooms` | Room state: players, chain, turns, status, winner, heartbeat timestamps |
| `players` | Cached player identity (shared) |
| `player_teams` | Cached team history (shared) |

## localStorage

| Key | Stores |
|-----|--------|
| `football-nerdle-mp-session` | `{ roomId, playerId, isHost }` for reconnection |
