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
- **Random** — Practice with random players from top European clubs
- **Hard Mode** — Only club badges shown (no names or years)

## Tech Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 4
- [Supabase](https://supabase.com/) for player data and multiplayer game rooms
- Player data sourced from [TransferMarkt](https://github.com/dcaribou/transfermarkt-datasets)

## Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Populating the database

Import player data from TransferMarkt datasets:

```bash
npx tsx scripts/import-transfermarkt.ts
```

This downloads player and transfer CSVs from TransferMarkt and populates the Supabase database with ~17,500 players from top European leagues. Requires the Supabase **service role key** (not the anon key).

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
