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
- [TheSportsDB](https://www.thesportsdb.com/) API for player data and club histories
- [Supabase](https://supabase.com/) for player data caching and multiplayer game rooms

## Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in your credentials:

```
VITE_SPORTSDB_API_KEY=3
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-key-here
```

### Seeding the player database

Populate Supabase with players from top European clubs:

```bash
npx tsx scripts/seed-players.ts
```

This fetches rosters from ~21 top clubs and caches their full club histories. The free TheSportsDB API has rate limits, so the script may need to be run multiple times.
