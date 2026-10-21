# Guess the Player

Route: `/guess` — Page: `index.tsx` — Hook: `useGuessGame.ts`

## How It Works

1. A player's club history is shown (badges only in hard mode, full details in normal mode)
2. Consecutive stints at related clubs are merged (e.g. Barcelona + Barcelona B = Barcelona)
3. National team entries are filtered out
4. User has 5 attempts to guess who it is
5. Wrong guesses are listed (`formatWrongGuesses` in `helpers.ts`, `data-testid="wrong-guesses"`) during play and, for the session they were made in, on the won/lost result screen under the revealed card; correct guess or 5 failures ends the game. Guesses are not persisted, so a re-opened completed puzzle shows no guess line
6. Result can be shared as emoji grid text (penalty-style circles). "Share Result" calls `shareResult` in `helpers.ts`: it opens the native share sheet (`navigator.share({ text })`) when available (and `canShare` allows it), falls back to the clipboard if there is no share sheet or it fails, and treats a dismissed sheet (`AbortError`) as cancelled. A clipboard copy shows "Copied!" for 2s; if both fail, a `role="alert"` message with the share text (for manual copying) is shown until the next click
7. A visually hidden `role="status"` live region (`data-testid="guess-announcer"`) announces each wrong guess, skip, win or loss to screen readers; text comes from `getGuessAnnouncement` in `helpers.ts` and is cleared whenever a new puzzle loads
8. Players already guessed wrong stay in the search dropdown but are greyed out, labelled "Already guessed" and can't be selected (`getAlreadyGuessedMap` → `PlayerSearch` `disabledPlayerIds`); `submitGuess` also ignores a repeated wrong guess, so it never costs an attempt. The list resets with each new puzzle and is not persisted
9. Today's daily result screen (not Archive/debug) shows `NextPuzzleCountdown`: "Next puzzle in HH:MM:SS" to the local midnight ending `today` (`getMsUntilNextDay` in `utils/dates.ts`, `formatCountdown` in `helpers.ts`); at zero it becomes a "Play new daily" button that reloads the page (the hook freezes `today` at mount)
10. While playing, the guess row (search + Skip, `data-testid="guess-bar"` in `PlayerCard`) is `sticky bottom-0`: it stays at the viewport bottom while the card runs past the fold and settles under the hints at the end of the card, so the search dropdown opens upward. No ancestor may set `overflow`, or sticky stops working

## Backwards Compatibility

The daily game must remain backwards compatible. Changing day numbering, share text format, or localStorage keys would invalidate existing players' streaks and shared results. Any changes must preserve:
- `getDayNumber` calculation (start date: 2026-03-24)
- Share text format and emoji grid layout
- localStorage key formats for daily results and stats

## Modes

- **Daily**: random player from `seedPlayers.ts` (107 players, TransferMarkt IDs), selected once per day via `daily_schedule` Supabase table. First user of the day picks randomly from unused seeds; all subsequent users see the same player. Never repeats until all 107 are used. Falls back to sequential day-number algorithm if Supabase is unavailable.
- **Archive**: play past daily puzzles via `?day=N`. Results saved per-date in localStorage but don't affect stats/streak. Prominent amber banner distinguishes archive from today's daily.
- **Hard mode**: ON by default. Shows only club badges (no names/years). One-way disable per day.
- **Hints**: wrong guesses progressively reveal nationality (1st), age (2nd), position (3rd), and photo (4th).
- **Debug**: `?id=tm_349066` loads a specific player by ID. No stats tracking, and the "Your Stats" panel is hidden on its result screen so it does not look as if the game counted. Its share text uses the `Random` label (kept for share-format compatibility). Its result screen offers "Play Today's Daily" (same button as Archive) so the player is never stuck on the debug puzzle.
- The removed Random mode's old `?mode` URL param is ignored: such links load today's daily.

## Data Flow

- All player data comes from Supabase (no runtime API calls)
- Daily player selection via `daily_schedule` table (api/dailySchedule.ts)
- "Today" is the player's local date from `utils/dates.ts` (`getTodayString` / `formatLocalDate`), shared by the game, Archive and Admin so they all pick the same `daily_schedule` row. Never use `toISOString()` to get a day: it is UTC and is off by one around local midnight
- Player search queries `players` table via `ilike`
- Guess matching compares by player ID or name (handles TransferMarkt ID differences)
- Loaders (`startDaily`, `loadArchiveDay`, `startById`) are guarded by `createLoadGuard`: the latest started load wins, and an older load's result or error is dropped

## File Structure

- `index.tsx` — Page component (UI, hard mode toggle, share, archive banner)
- `useGuessGame.ts` — Hook: daily/archive/debug logic, guess submission, hints, stats
- `types.ts` — GuessStatus, GuessGameState, DailyResult, GuessStats, RevealedHints
- `constants.ts` — MAX_ATTEMPTS, localStorage keys, DAY_ONE_DATE, SHARE_URL, STATS_KEY
- `helpers.ts` — Date helpers, daily result persistence, club merging, stats recording, guess distribution (`loadDistribution`/`recordWin`)
- `GuessDistribution/index.tsx` — "Guess Distribution" bar chart (daily wins by attempts) inside the "Your Stats" panel
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
| `football-nerdle-guess-distribution` | `{ "1": n, ..., "5": n }` — daily wins by attempts; only updated by daily wins (not losses or archive), started empty on release (no backfill). Must not use the `football-nerdle-daily-` prefix |
