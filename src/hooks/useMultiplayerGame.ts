import { useState, useCallback, useRef, useEffect } from "react";
import { didPlayTogether, ApiError } from "../api/sportsdb";
import { getPlayerWithTeamsCached } from "../api/playerCache";
import { startGame, submitTurn, endGame, subscribeToRoom, getRoom } from "../api/multiplayerRoom";
import type { Player, GameRoom } from "../types";
import { SEED_PLAYERS } from "../data/seedPlayers";
import type { RealtimeChannel } from "@supabase/supabase-js";

type GameStatus = "starting" | "playing" | "checking" | "finished";

interface WrongResult {
  player: Player;
  checkedClubs: { a: string[]; b: string[] };
}

interface MultiplayerGameState {
  room: GameRoom;
  status: GameStatus;
  error: string | null;
  wrongResult: WrongResult | null;
}

const TURN_TIME = 15;

export function useMultiplayerGame(
  initialRoom: GameRoom,
  playerId: string,
  isHost: boolean,
) {
  const [state, setState] = useState<MultiplayerGameState>({
    room: initialRoom,
    status: "starting",
    error: null,
    wrongResult: null,
  });

  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const opponentId = isHost ? state.room.guest_id! : state.room.host_id;
  const isMyTurn = state.room.current_turn === playerId;
  const currentPlayer = state.room.chain.length > 0
    ? state.room.chain[state.room.chain.length - 1]
    : null;

  function deriveStatus(room: GameRoom, prev: GameStatus): GameStatus {
    if (room.status === "finished") return "finished";
    if (room.status === "playing") {
      // If we were checking and it's now our turn, go back to playing
      if (prev === "checking" && room.current_turn === playerId) return "playing";
      // If we were in starting state and game started, move to playing
      if (prev === "starting") return "playing";
      // Keep current local status (e.g. "checking" while our submission is in flight)
      return prev;
    }
    return prev;
  }

  // Subscribe to room updates
  useEffect(() => {
    channelRef.current = subscribeToRoom(state.room.id, (room) => {
      setState((s) => ({ ...s, room, status: deriveStatus(room, s.status) }));
    });
    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [state.room.id, playerId]);

  // Poll as fallback in case Realtime misses events
  useEffect(() => {
    if (state.status === "finished") return;
    const interval = setInterval(async () => {
      const room = await getRoom(state.room.id);
      if (room) {
        setState((s) => {
          // Only update if something actually changed
          if (room.status === s.room.status && room.current_turn === s.room.current_turn && room.chain.length === s.room.chain.length) {
            return s;
          }
          return { ...s, room, status: deriveStatus(room, s.status) };
        });
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [state.room.id, state.status]);

  // Timer management
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setTimeLeft(TURN_TIME);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [stopTimer]);

  // Sync timer to turn_started_at from DB
  useEffect(() => {
    if (state.room.status !== "playing" || !state.room.turn_started_at) {
      stopTimer();
      return;
    }

    const turnStart = new Date(state.room.turn_started_at).getTime();
    const elapsed = Math.floor((Date.now() - turnStart) / 1000);
    const remaining = Math.max(0, TURN_TIME - elapsed);

    if (remaining <= 0) {
      setTimeLeft(0);
      return;
    }

    setTimeLeft(remaining);
    // Clear any existing timer and start a fresh one from the calculated remaining
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => stopTimer();
  }, [state.room.turn_started_at, state.room.status, stopTimer]);

  // Handle timeout
  useEffect(() => {
    if (timeLeft === 0 && state.room.status === "playing" && isMyTurn) {
      endGame(state.room.id, opponentId, "timeout");
    }
  }, [timeLeft, state.room.status, state.room.id, isMyTurn, opponentId]);

  // Cleanup on unmount
  useEffect(() => stopTimer, [stopTimer]);

  // Host starts the game
  const handleStart = useCallback(async () => {
    if (!isHost) return;
    setState((s) => ({ ...s, status: "starting", error: null }));
    try {
      const seed = SEED_PLAYERS[Math.floor(Math.random() * SEED_PLAYERS.length)];
      const playerWithTeams = await getPlayerWithTeamsCached(seed);
      await startGame(state.room.id, playerId, playerWithTeams);
      setState((s) => ({
        ...s,
        room: {
          ...s.room,
          status: "playing",
          chain: [playerWithTeams],
          used_player_ids: [playerWithTeams.id],
          current_turn: playerId,
          turn_started_at: new Date().toISOString(),
        },
        status: "playing",
      }));
      startTimer();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to start game";
      setState((s) => ({ ...s, error: msg }));
    }
  }, [isHost, state.room.id, playerId, startTimer]);

  // Submit a player guess
  const handleSubmit = useCallback(async (player: Player) => {
    if (!isMyTurn || !currentPlayer || state.status !== "playing") return;
    if (state.room.used_player_ids.includes(player.id)) return;

    stopTimer();
    setState((s) => ({ ...s, status: "checking", error: null }));

    try {
      const playerWithTeams = await getPlayerWithTeamsCached(player);
      const result = didPlayTogether(currentPlayer, playerWithTeams);

      if (result.together) {
        const newChain = [...state.room.chain, playerWithTeams];
        const newUsed = [...state.room.used_player_ids, playerWithTeams.id];
        const success = await submitTurn(
          state.room.id,
          playerId,
          opponentId,
          newChain,
          newUsed,
          result.clubs,
        );
        if (!success) {
          // Turn was already taken (e.g. timeout fired)
          setState((s) => ({ ...s, status: "playing", error: "Turn expired" }));
        }
        // Room update will come via Realtime subscription
      } else {
        setState((s) => ({
          ...s,
          wrongResult: {
            player,
            checkedClubs: {
              a: currentPlayer.formerTeams.map((t) => t.teamName),
              b: playerWithTeams.formerTeams.map((t) => t.teamName),
            },
          },
        }));
        await endGame(state.room.id, opponentId, "wrong");
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Something went wrong";
      setState((s) => ({ ...s, status: "playing", error: msg }));
      startTimer();
    }
  }, [isMyTurn, currentPlayer, state.status, state.room, playerId, opponentId, stopTimer, startTimer]);

  return {
    room: state.room,
    status: state.status,
    error: state.error,
    wrongResult: state.wrongResult,
    currentPlayer,
    isMyTurn,
    isHost,
    playerId,
    opponentId,
    timeLeft,
    startGame: handleStart,
    submitPlayer: handleSubmit,
  };
}
