import { useState, useCallback, useRef, useEffect } from "react";
import { didPlayTogether, ApiError } from "../api/sportsdb";
import { getPlayerWithTeamsCached } from "../api/playerCache";
import { startGame, submitTurn, endGame, subscribeToRoom, getRoom, sendHeartbeat } from "../api/multiplayerRoom";
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
const HEARTBEAT_INTERVAL = 3_000;   // send heartbeat every 3s
const DISCONNECT_THRESHOLD = 10_000; // consider disconnected after 10s without heartbeat
const DISCONNECT_GRACE = 60_000;     // end game after 60s disconnected

export function useMultiplayerGame(
  initialRoom: GameRoom,
  playerId: string,
  isHost: boolean,
) {
  const [state, setState] = useState<MultiplayerGameState>(() => {
    let status: GameStatus = "starting";
    if (initialRoom.status === "playing") status = "playing";
    else if (initialRoom.status === "finished") status = "finished";
    return { room: initialRoom, status, error: null, wrongResult: null };
  });

  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const [opponentConnected, setOpponentConnected] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const opponentId = isHost ? state.room.guest_id! : state.room.host_id;
  const isMyTurn = state.room.current_turn === playerId;
  const chain = state.room.chain ?? [];
  const currentPlayer = chain.length > 0
    ? chain[chain.length - 1]
    : null;

  function deriveStatus(room: GameRoom, prev: GameStatus): GameStatus {
    if (room.status === "finished") return "finished";
    if (room.status === "playing") {
      if (prev === "starting" || prev === "finished") return "playing";
      if (prev === "checking" && room.current_turn === playerId) return "playing";
      return prev;
    }
    return prev;
  }

  function applyRoomUpdate(incoming: GameRoom) {
    setState((s) => {
      const room: GameRoom = {
        ...s.room,
        ...incoming,
        chain: incoming.chain ?? s.room.chain ?? [],
        used_player_ids: incoming.used_player_ids ?? s.room.used_player_ids ?? [],
        last_shared_clubs: incoming.last_shared_clubs ?? s.room.last_shared_clubs ?? [],
      };
      const newStatus = deriveStatus(room, s.status);
      const clearWrong = s.status === "finished" && newStatus === "playing";
      return {
        ...s,
        room,
        status: newStatus,
        wrongResult: clearWrong ? null : s.wrongResult,
        error: clearWrong ? null : s.error,
      };
    });
  }

  // Subscribe to room updates (DB changes only, no Presence)
  useEffect(() => {
    channelRef.current = subscribeToRoom(state.room.id, applyRoomUpdate);
    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [state.room.id, playerId]);

  // Heartbeat: send our last_seen every 3s
  useEffect(() => {
    if (state.status === "finished") return;
    sendHeartbeat(state.room.id, isHost);
    const interval = setInterval(() => {
      sendHeartbeat(state.room.id, isHost);
    }, HEARTBEAT_INTERVAL);
    return () => clearInterval(interval);
  }, [state.room.id, isHost, state.status]);

  // Detect opponent disconnect by polling their last_seen directly from DB
  const opponentConnectedRef = useRef(true);
  useEffect(() => {
    if (state.status === "finished") return;
    const interval = setInterval(async () => {
      const room = await getRoom(state.room.id);
      if (!room) return;
      const opponentLastSeen = isHost ? room.guest_last_seen : room.host_last_seen;
      if (!opponentLastSeen) return;
      const elapsed = Date.now() - new Date(opponentLastSeen).getTime();
      const isConnected = elapsed < DISCONNECT_THRESHOLD;
      const wasConnected = opponentConnectedRef.current;
      opponentConnectedRef.current = isConnected;
      setOpponentConnected(isConnected);

      if (!isConnected && wasConnected) {
        if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = setTimeout(() => {
          setState((s) => {
            if (s.room.status === "playing") {
              endGame(s.room.id, playerId, "disconnect");
            }
            return s;
          });
        }, DISCONNECT_GRACE);
      } else if (isConnected && !wasConnected) {
        if (disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
      }
    }, 3000);
    return () => {
      clearInterval(interval);
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
      }
    };
  }, [state.room.id, state.status, isHost, playerId]);

  // Poll room as fallback
  useEffect(() => {
    const interval = setInterval(async () => {
      const room = await getRoom(state.room.id);
      if (room) {
        setState((s) => {
          const roomChain = room.chain ?? [];
          const prevChain = s.room.chain ?? [];
          if (
            room.status === s.room.status &&
            room.current_turn === s.room.current_turn &&
            roomChain.length === prevChain.length &&
            room.winner === s.room.winner
          ) {
            // Still update heartbeat fields even if game state hasn't changed
            return {
              ...s,
              room: { ...s.room, host_last_seen: room.host_last_seen, guest_last_seen: room.guest_last_seen },
            };
          }
          const merged: GameRoom = {
            ...s.room,
            ...room,
            chain: room.chain ?? s.room.chain ?? [],
            used_player_ids: room.used_player_ids ?? s.room.used_player_ids ?? [],
            last_shared_clubs: room.last_shared_clubs ?? s.room.last_shared_clubs ?? [],
          };
          const newStatus = deriveStatus(merged, s.status);
          const clearWrong = s.status === "finished" && newStatus === "playing";
          return {
            ...s,
            room: merged,
            status: newStatus,
            wrongResult: clearWrong ? null : s.wrongResult,
            error: clearWrong ? null : s.error,
          };
        });
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [state.room.id, playerId]);

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

  // Sync timer to turn_started_at — pause when opponent disconnects
  useEffect(() => {
    if (state.room.status !== "playing" || !state.room.turn_started_at || !opponentConnected) {
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
  }, [state.room.turn_started_at, state.room.status, opponentConnected, stopTimer]);

  // Handle timeout (don't trigger while opponent disconnected)
  useEffect(() => {
    if (timeLeft === 0 && state.room.status === "playing" && isMyTurn && opponentConnected) {
      endGame(state.room.id, opponentId, "timeout");
    }
  }, [timeLeft, state.room.status, state.room.id, isMyTurn, opponentId, opponentConnected]);

  // Cleanup on unmount
  useEffect(() => stopTimer, [stopTimer]);

  // Host starts or rematches
  const handleStart = useCallback(async () => {
    if (!isHost) return;
    setState((s) => ({ ...s, status: "starting", error: null, wrongResult: null }));
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
          last_shared_clubs: [],
          current_turn: playerId,
          turn_started_at: new Date().toISOString(),
          winner: null,
          lose_reason: null,
          score: 0,
        },
        status: "playing",
        wrongResult: null,
        error: null,
      }));
      startTimer();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to start game";
      setState((s) => ({ ...s, status: "finished", error: msg }));
    }
  }, [isHost, state.room.id, playerId, startTimer]);

  // Submit a player guess
  const handleSubmit = useCallback(async (player: Player) => {
    if (!isMyTurn || !currentPlayer || state.status !== "playing") return;
    if ((state.room.used_player_ids ?? []).includes(player.id)) return;

    stopTimer();
    setState((s) => ({ ...s, status: "checking", error: null }));

    try {
      const playerWithTeams = await getPlayerWithTeamsCached(player);
      const result = didPlayTogether(currentPlayer, playerWithTeams);

      if (result.together) {
        const newChain = [...chain, playerWithTeams];
        const newUsed = [...(state.room.used_player_ids ?? []), playerWithTeams.id];
        const success = await submitTurn(
          state.room.id,
          playerId,
          opponentId,
          newChain,
          newUsed,
          result.clubs,
        );
        if (!success) {
          setState((s) => ({ ...s, status: "playing", error: "Turn expired" }));
        }
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
  }, [isMyTurn, currentPlayer, state.status, state.room, chain, playerId, opponentId, stopTimer, startTimer]);

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
    opponentConnected,
    timeLeft,
    startGame: handleStart,
    submitPlayer: handleSubmit,
  };
}
