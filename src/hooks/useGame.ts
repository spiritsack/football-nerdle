import { useState, useCallback } from "react";
import { getPlayerWithTeams, didPlayTogether } from "../api/sportsdb";
import type { Player, PlayerWithTeams } from "../types";

type GameStatus = "loading" | "playing" | "checking" | "wrong" | "gameover";

interface WrongResult {
  player: Player;
  checkedClubs: { a: string[]; b: string[] };
}

interface GameState {
  chain: PlayerWithTeams[];
  currentPlayer: PlayerWithTeams | null;
  score: number;
  status: GameStatus;
  lastSharedClubs: string[];
  wrongResult: WrongResult | null;
  usedPlayerIds: Set<string>;
}

const SEED_PLAYERS: Player[] = [
  { id: "34146370", name: "Lionel Messi", thumbnail: "", nationality: "Argentina" },
  { id: "34146304", name: "Cristiano Ronaldo", thumbnail: "", nationality: "Portugal" },
  { id: "34146371", name: "Neymar", thumbnail: "", nationality: "Brazil" },
  { id: "34145657", name: "Wayne Rooney", thumbnail: "", nationality: "England" },
  { id: "34152577", name: "Zlatan Ibrahimovic", thumbnail: "", nationality: "Sweden" },
  { id: "34161137", name: "Thierry Henry", thumbnail: "", nationality: "France" },
  { id: "34159850", name: "Ronaldinho", thumbnail: "", nationality: "Brazil" },
  { id: "34146363", name: "Andres Iniesta", thumbnail: "", nationality: "Spain" },
  { id: "34146362", name: "Xavi", thumbnail: "", nationality: "Spain" },
  { id: "34145910", name: "Steven Gerrard", thumbnail: "", nationality: "England" },
  { id: "34145590", name: "Frank Lampard", thumbnail: "", nationality: "England" },
  { id: "34161122", name: "David Beckham", thumbnail: "", nationality: "England" },
  { id: "34162098", name: "Kylian Mbappé", thumbnail: "", nationality: "France" },
  { id: "34146705", name: "Robert Lewandowski", thumbnail: "", nationality: "Poland" },
  { id: "34145610", name: "Sergio Agüero", thumbnail: "", nationality: "Argentina" },
  { id: "34160533", name: "Andrea Pirlo", thumbnail: "", nationality: "Italy" },
  { id: "34146106", name: "Rio Ferdinand", thumbnail: "", nationality: "England" },
  { id: "34145497", name: "John Terry", thumbnail: "", nationality: "England" },
  { id: "34145536", name: "Didier Drogba", thumbnail: "", nationality: "Ivory Coast" },
];

const BEST_STREAK_KEY = "football-nerdle-best-streak";

function loadBestStreak(): number {
  const stored = localStorage.getItem(BEST_STREAK_KEY);
  return stored ? parseInt(stored, 10) || 0 : 0;
}

export function useGame() {
  const [bestStreak, setBestStreak] = useState(loadBestStreak);
  const [state, setState] = useState<GameState>({
    chain: [],
    currentPlayer: null,
    score: 0,
    status: "loading",
    lastSharedClubs: [],
    wrongResult: null,
    usedPlayerIds: new Set(),
  });

  const startGame = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading", wrongResult: null }));
    const seed = SEED_PLAYERS[Math.floor(Math.random() * SEED_PLAYERS.length)];
    const playerWithTeams = await getPlayerWithTeams(seed);
    setState({
      chain: [playerWithTeams],
      currentPlayer: playerWithTeams,
      score: 0,
      status: "playing",
      lastSharedClubs: [],
      wrongResult: null,
      usedPlayerIds: new Set([playerWithTeams.id]),
    });
  }, []);

  const submitPlayer = useCallback(
    async (player: Player) => {
      if (!state.currentPlayer) return;
      if (state.usedPlayerIds.has(player.id)) return;
      setState((s) => ({ ...s, status: "checking" }));

      const playerWithTeams = await getPlayerWithTeams(player);
      const result = didPlayTogether(state.currentPlayer, playerWithTeams);

      if (result.together) {
        setState((s) => {
          const newUsed = new Set(s.usedPlayerIds);
          newUsed.add(playerWithTeams.id);
          return {
            ...s,
            chain: [...s.chain, playerWithTeams],
            currentPlayer: playerWithTeams,
            score: s.score + 1,
            status: "playing",
            lastSharedClubs: result.clubs,
            usedPlayerIds: newUsed,
          };
        });
      } else {
        setState((s) => {
          const finalScore = s.score;
          if (finalScore > loadBestStreak()) {
            localStorage.setItem(BEST_STREAK_KEY, String(finalScore));
            setBestStreak(finalScore);
          }
          return {
            ...s,
            status: "gameover",
            wrongResult: {
              player,
              checkedClubs: {
                a: s.currentPlayer!.formerTeams.map((t) => t.teamName),
                b: playerWithTeams.formerTeams.map((t) => t.teamName),
              },
            },
          };
        });
      }
    },
    [state.currentPlayer]
  );

  return {
    ...state,
    bestStreak,
    startGame,
    submitPlayer,
  };
}
