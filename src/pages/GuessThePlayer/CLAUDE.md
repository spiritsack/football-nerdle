# Guess the Player

Route: `/guess` — Page: `index.tsx` — Hook: `useGuessGame.ts`

## How It Works

1. A player's club history is shown (badges only in hard mode, full details in normal mode)
2. User has 5 attempts to guess who the player is
3. Wrong guesses are listed; correct guess or 5 failures ends the game
4. Result can be shared as emoji grid text

## Modes

- **Daily**: deterministic player based on date hash. Day numbering starts from 2026-03-24.
- **Random**: picks a random seed player.
- **Hard mode**: ON by default. Shows only club badges. One-way disable per day.

## File Structure

- `index.tsx` — Page component (UI, hard mode toggle, share)
- `useGuessGame.ts` — Hook: daily/random logic, guess submission
- `types.ts` — GuessStatus, GuessGameState, DailyResult
- `constants.ts` — MAX_ATTEMPTS, localStorage keys, DAY_ONE_DATE, SHARE_URL
- `helpers.ts` — Date helpers, daily result persistence

## localStorage

| Key | Stores |
|-----|--------|
| `football-nerdle-daily-guess` | `{ date, status, attempts }` |
| `football-nerdle-hard-mode-disabled` | `{ date }` if disabled today |
