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

The daily game must remain backwards compatible. Changing day numbering, share text format, or localStorage keys would invalidate existing players' streaks and shared results. Any changes must preserve:
- `getDayNumber` calculation (start date: 2026-03-24)
- Share text format and emoji grid layout
- localStorage key formats for daily results and stats

## Modes

- **Daily**: random player from `seedPlayers.ts` (107 players, TransferMarkt IDs), selected once per day via `daily_schedule` Supabase table. First user of the day picks randomly from unused seeds; all subsequent users see the same player. Never repeats until all 107 are used. Falls back to sequential day-number algorithm if Supabase is unavailable.
- **Archive**: play past daily puzzles via `?day=N`. Results saved per-date in localStorage but don't affect stats/streak. Prominent amber banner distinguishes archive from today's daily.
- **Random**: picks a random player from Supabase with at least 3 clubs, filtered to top club players. No stats tracking.
- **Hard mode**: ON by default. Shows only club badges (no names/years). One-way disable per day.
- **Hints**: wrong guesses progressively reveal nationality (1st), age (2nd), position (3rd), and photo (4th).
- **Debug**: `?id=tm_349066` loads a specific player by ID.

## Data Flow

- All player data comes from Supabase (no runtime API calls)
- Daily player selection via `daily_schedule` table (api/dailySchedule.ts)
- Player search queries `players` table via `ilike`
- Guess matching compares by player ID or name (handles TransferMarkt ID differences)

## File Structure

- `index.tsx` — Page component (UI, hard mode toggle, share, archive banner)
- `useGuessGame.ts` — Hook: daily/archive/random logic, guess submission, hints, stats
- `types.ts` — GuessStatus, GuessGameState, DailyResult, GuessStats, RevealedHints
- `constants.ts` — MAX_ATTEMPTS, localStorage keys, DAY_ONE_DATE, SHARE_URL, STATS_KEY
- `helpers.ts` — Date helpers, daily result persistence, club merging, stats recording
- `Archive/index.tsx` — Archive page listing past daily puzzles with results

## Supabase Tables

| Table | Purpose |
|-------|---------|
| `daily_schedule` | `{ date, player_id }` — one record per day, immutable |

## localStorage

| Key | Stores |
|-----|--------|
| `football-nerdle-daily-guess` | `{ date, status, attempts }` — legacy key, kept in sync for backwards compat |
| `football-nerdle-daily-YYYY-MM-DD` | `{ date, status, attempts }` — per-date result (daily + archive) |
| `football-nerdle-hard-mode-disabled` | `{ date }` if disabled today |
| `football-nerdle-guess-stats` | `{ played, won, lost, streak, longestStreak }` (daily only, archive doesn't affect) |
