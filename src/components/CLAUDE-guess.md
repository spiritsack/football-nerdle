# Guess the Player

Route: `/guess` — Component: `GuessGame.tsx` — Hook: `../hooks/useGuessGame.ts`

## How It Works

1. A player's club history is shown (badges only in hard mode, full details in normal mode)
2. User has 5 attempts to guess who the player is via the search autocomplete
3. Wrong guesses are listed; correct guess or 5 failures ends the game
4. Result can be shared as emoji grid text

## Modes

- **Daily**: deterministic player based on date hash (`getDailyPlayerIndex`). Auto-starts on mount. Day numbering starts from 2026-03-24.
- **Random**: picks a random seed player. Available after completing daily (or anytime via button).
- **Hard mode**: ON by default. Shows only club badges (no names/years). Can be disabled once per day — one-way toggle, cannot be re-enabled until next day.

## State Machine

`loading` (auto on mount) → `playing` → `won` | `lost`

Error during load → `idle` (with error message, retry button)

## Key Logic (`useGuessGame.ts`)

- `startDaily()` — computes daily index, fetches player, checks if already completed today
- `startRandom()` — picks random seed, fetches player
- `submitGuess(player)` — compares player ID to target; updates attempts/wrong guesses
- `getShareText(hardMode?)` — generates shareable emoji grid with day number and score

## localStorage

| Key | Stores |
|-----|--------|
| `football-nerdle-daily-guess` | `{ date: string, status: "won"\|"lost", attempts: number }` |
| `football-nerdle-hard-mode-disabled` | `{ date: string }` if hard mode was disabled today |
