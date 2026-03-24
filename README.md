# Football Nerdle

A football chain-link game inspired by cine2nerdle's battle mode. Name a footballer who played with the current player to keep the chain going.

**Play it:** https://spiritsack.github.io/football-nerdle/

## How to Play

1. The game starts with a random well-known footballer
2. You have **15 seconds** to name a player who played at the same club during overlapping years
3. If correct, that player becomes the new target — keep the chain going!
4. The game ends if you pick a wrong player or run out of time
5. Your best streak is saved locally

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- [TheSportsDB](https://www.thesportsdb.com/) API for player data and club histories

## Development

```bash
npm install
npm run dev
```

Create a `.env` file with your TheSportsDB API key:

```
VITE_SPORTSDB_API_KEY=your_key_here
```
