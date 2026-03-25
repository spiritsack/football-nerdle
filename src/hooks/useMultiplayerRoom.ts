import { useState, useCallback, useEffect, useRef } from "react";
import { createRoom, joinRoom, subscribeToRoom, getRoom } from "../api/multiplayerRoom";
import type { GameRoom } from "../types";
import type { RealtimeChannel } from "@supabase/supabase-js";

type LobbyStatus = "idle" | "creating" | "waiting" | "joining" | "ready" | "error";

interface LobbyState {
  status: LobbyStatus;
  room: GameRoom | null;
  playerId: string | null;
  isHost: boolean;
  error: string | null;
}

export function useMultiplayerRoom() {
  const [state, setState] = useState<LobbyState>({
    status: "idle",
    room: null,
    playerId: null,
    isHost: false,
    error: null,
  });

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Clean up any existing subscription before starting a new one
  function cleanupChannel() {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
  }

  const handleRoomUpdate = useCallback((room: GameRoom) => {
    setState((s) => {
      if (s.status === "waiting" && room.guest_id) {
        return { ...s, room, status: "ready" };
      }
      return { ...s, room };
    });
  }, []);

  const handleCreate = useCallback(async () => {
    cleanupChannel();
    setState((s) => ({ ...s, status: "creating", error: null }));
    try {
      const { room, playerId } = await createRoom();
      channelRef.current = subscribeToRoom(room.id, handleRoomUpdate);
      setState({ status: "waiting", room, playerId, isHost: true, error: null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create room";
      setState((s) => ({ ...s, status: "error", error: msg }));
    }
  }, [handleRoomUpdate]);

  const handleJoin = useCallback(async (code: string) => {
    cleanupChannel();
    setState((s) => ({ ...s, status: "joining", error: null }));
    try {
      const { room, playerId } = await joinRoom(code);
      channelRef.current = subscribeToRoom(room.id, handleRoomUpdate);
      setState({ status: "ready", room, playerId, isHost: false, error: null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to join room";
      setState((s) => ({ ...s, status: "error", error: msg }));
    }
  }, [handleRoomUpdate]);

  // Check for ?code= in URL on mount only (empty deps — run once)
  const autoJoinRan = useRef(false);
  useEffect(() => {
    if (autoJoinRan.current) return;
    autoJoinRan.current = true;
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const code = params.get("code");
    if (code) {
      // Clear the code from URL to prevent re-joins on navigation
      const baseHash = window.location.hash.split("?")[0];
      window.history.replaceState(null, "", baseHash);
      handleJoin(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => cleanupChannel();
  }, []);

  // Poll for room updates as a fallback
  useEffect(() => {
    if (state.status !== "waiting" || !state.room) return;
    const interval = setInterval(async () => {
      const room = await getRoom(state.room!.id);
      if (room?.guest_id) {
        handleRoomUpdate(room);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [state.status, state.room, handleRoomUpdate]);

  return {
    ...state,
    createRoom: handleCreate,
    joinRoom: handleJoin,
    channel: channelRef,
  };
}
