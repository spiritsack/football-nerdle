# Battle Mode (Single-player)

Route: `/battle` — Page: `index.tsx` — Hook: `useGame.ts`

## How It Works

1. Player clicks Start, a random seed player is loaded
2. Player must name footballers who played at the same club (with overlapping years)
3. 15-second timer per turn; each correct answer extends the chain
4. Game ends on wrong answer, timeout, or API error

## State Machine

`idle` → `loading` → `playing` ↔ `checking` → `gameover`

## File Structure

- `index.tsx` — Page component (UI)
- `useGame.ts` — Hook: game state, timer, chain building
- `types.ts` — GameStatus, WrongResult, GameState
- `constants.ts` — BEST_STREAK_KEY
- `helpers.ts` — loadBestStreak, saveBestStreak

## localStorage

| Key | Stores |
|-----|--------|
| `football-nerdle-best-streak` | Best chain score (number) |
