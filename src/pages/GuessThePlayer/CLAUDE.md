# Guess the Player

Route: `/guess` — Page: `index.tsx` — Hook: `useGuessGame.ts`

## How It Works

1. A player's club history is shown (badges only in hard mode, full details in normal mode)
2. Consecutive stints at related clubs are merged (e.g. Barcelona + Barcelona B = Barcelona)
3. National team entries are filtered out
4. User has 5 attempts to guess who it is
5. Wrong guesses are listed; correct guess or 5 failures ends the game
6. Result can be shared as emoji grid text (penalty-style circles)

## Backwards Compatibility

The daily game must remain backwards compatible. Changing the daily player selection algorithm, day numbering, or share text format would invalidate existing players' streaks and shared results. Any changes to the daily mode must preserve:
- `getDailyPlayerIndex` hash function
- `getDayNumber` calculation (start date: 2026-03-24)
- Share text format and emoji grid layout
- localStorage key formats for daily results and stats

## Modes

- **Daily**: deterministic player based on date hash from `seedPlayers.ts` (19 players, TransferMarkt IDs). Day numbering starts from 2026-03-24.
- **Random**: picks a random player from Supabase with at least 3 clubs, filtered to top club players. No stats tracking.
- **Hard mode**: ON by default. Shows only club badges (no names/years). One-way disable per day.
- **Debug**: `?id=tm_349066` loads a specific player by ID.

## Data Flow

- All player data comes from Supabase (no runtime API calls)
- Player search queries `players` table via `ilike`
- Guess matching compares by player ID or name (handles TheSportsDB/TransferMarkt ID differences)

## File Structure

- `index.tsx` — Page component (UI, hard mode toggle, share, club merging display logic)
- `useGuessGame.ts` — Hook: daily/random logic, guess submission, stats
- `types.ts` — GuessStatus, GuessGameState, DailyResult, GuessStats
- `constants.ts` — MAX_ATTEMPTS, localStorage keys, DAY_ONE_DATE, SHARE_URL, STATS_KEY
- `helpers.ts` — Date helpers, daily result persistence, stats recording

## localStorage

| Key | Stores |
|-----|--------|
| `football-nerdle-daily-guess` | `{ date, status, attempts }` |
| `football-nerdle-hard-mode-disabled` | `{ date }` if disabled today |
| `football-nerdle-guess-stats` | `{ played, won, lost, streak, longestStreak }` (daily only) |
