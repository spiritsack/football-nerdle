# Guess the Player

Route: `/guess` — Page: `index.tsx` — Hook: `useGuessGame.ts`

## How It Works

1. A player's club history is shown (badges only in hard mode, full details in normal mode)
2. User has 5 attempts to guess who the player is
3. Wrong guesses are listed; correct guess or 5 failures ends the game
4. Result can be shared as emoji grid text

## Backwards Compatibility

The daily game must remain backwards compatible. Changing the daily player selection algorithm, day numbering, or share text format would invalidate existing players' streaks and shared results. Any changes to the daily mode must preserve:
- `getDailyPlayerIndex` hash function
- `getDayNumber` calculation (start date: 2026-03-24)
- Share text format and emoji grid layout
- localStorage key formats for daily results and stats

## Modes

- **Daily**: deterministic player based on date hash. Day numbering starts from 2026-03-24.
- **Random**: picks a random player from the Supabase cache pool (~200+ players from top clubs). Falls back to seed players if pool is empty. Triggers daily pool refresh on first play.
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
| `football-nerdle-guess-stats` | `{ played, won, lost, streak, longestStreak }` |
