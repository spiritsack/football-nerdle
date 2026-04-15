# Football Nerdle

A football (soccer) trivia web app with multiple game modes.

**Play it:** https://spiritsack.github.io/football-nerdle/

## Game Modes

### Battle Mode
Name footballers who played together to build the longest chain. You have **15 seconds** per turn.

- **Practice** — Solo mode, try to beat your best streak
- **Play with a Friend** — Real-time online multiplayer via shared room code

### Guess the Player
See a player's club history and guess who it is in **5 attempts**.

- **Daily** — Same player for everyone each day, with a shareable result
- **Archive** — Play past daily puzzles you missed
- **Random** — Practice with random players from top European clubs
- **Hard Mode** — Only club badges shown (no names or years)
- **Hints** — Wrong guesses progressively reveal nationality, age, position, and photo
- **Loan indicators** — Loan spells shown with dashed borders
- **Legacy players** — Retired players shown with vintage-styled cards
- **Daily leaderboard** — See how the community did after completing a puzzle

## Tech Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 4
- [Supabase](https://supabase.com/) for player data, multiplayer game rooms, and admin auth
- Player data sourced from [TransferMarkt](https://github.com/dcaribou/transfermarkt-datasets) (~47,000 players) + [Wikidata](https://www.wikidata.org/) career backfill

## Development

```bash
npm install
npm run dev        # Staging database
npm run dev:prod   # Production database
```

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Populating the database

Import player data from TransferMarkt datasets:

```bash
# Import players from top 7 European leagues
SUPABASE_SERVICE_ROLE_KEY=your-key npx tsx scripts/import-transfermarkt.ts

# Import all players from the dataset (~47k players)
SUPABASE_SERVICE_ROLE_KEY=your-key npx tsx scripts/import-transfermarkt.ts --all
```

Backfill missing club history from Wikidata:

```bash
# Backfill all players missing transfer data
VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/backfill-wikidata.ts

# Test with a single player (by TransferMarkt ID)
VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/backfill-wikidata.ts --player 3220
```

Copy data between Supabase instances (e.g. production to staging):

```bash
SOURCE_SUPABASE_URL=... SOURCE_SUPABASE_SERVICE_KEY=... \
TARGET_SUPABASE_URL=... TARGET_SUPABASE_SERVICE_KEY=... \
npx tsx scripts/copy-db.ts
```

All import/copy scripts require the Supabase **service role key** (RLS restricts writes to admin users).

### Admin interface

The admin panel at `/#/admin` is protected by Supabase Auth (email/password). Admin users are managed via the `admin_users` database table.

Features:
- Curate the daily puzzle schedule (approve, skip, search any player)
- Edit player club history (reorder, hide, mark as loan/youth team)
- Upload club crests
- Wiki lookup links for quick player reference

### Running tests

```bash
npm test          # Unit tests (Vitest)
npm run test:e2e  # E2E tests (Playwright)
```

### Contributing

- Create a feature branch from `main` (`feat/description`, `fix/description`)
- Use [conventional commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, etc.)
- Include tests for new features and bug fixes
- Open a pull request — CI runs tests before deploy is allowed
