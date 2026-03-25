import { useState, useCallback, useEffect, useRef } from "react";
import { createRoom, joinRoom, subscribeToRoom, getRoom, resetTurnTimer } from "../../api/multiplayerRoom";
import type { GameRoom } from "../../types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { LobbyState } from "./types";
import { saveSession, loadSession, clearSession } from "./helpers";

export function useMultiplayerRoom() {
  const [state, setState] = useState<LobbyState>({
    status: "idle",
    room: null,
    playerId: null,
    isHost: false,
    error: null,
  });

  const channelRef = useRef<RealtimeChannel | null>(null);

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
      saveSession(room.id, playerId, true);
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
      const session = loadSession();
      const { room, playerId, isHost } = await joinRoom(code, session?.playerId);
      saveSession(room.id, playerId, isHost);
      if (room.status === "playing" && room.turn_started_at) {
        const elapsed = (Date.now() - new Date(room.turn_started_at).getTime()) / 1000;
        if (elapsed > 15) {
          await resetTurnTimer(room.id);
          room.turn_started_at = new Date().toISOString();
        }
      }
      channelRef.current = subscribeToRoom(room.id, handleRoomUpdate);
      const isReady = isHost
        ? !!room.guest_id
        : true;
      setState({ status: isReady ? "ready" : "waiting", room, playerId, isHost, error: null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to join room";
      setState((s) => ({ ...s, status: "error", error: msg }));
    }
  }, [handleRoomUpdate]);

  const handleReconnect = useCallback(async (session: { roomId: string; playerId: string; isHost: boolean }) => {
    cleanupChannel();
    setState((s) => ({ ...s, status: "reconnecting", error: null }));
    try {
      const room = await getRoom(session.roomId);
      if (!room) {
        clearSession();
        setState({ status: "idle", room: null, playerId: null, isHost: false, error: null });
        return;
      }
      const roomAge = Date.now() - new Date(room.created_at).getTime();
      const isStale = roomAge > 2 * 60 * 60 * 1000;
      if (room.status === "finished" || isStale) {
        clearSession();
        setState({ status: "idle", room: null, playerId: null, isHost: false, error: null });
        return;
      }
      const isParticipant =
        room.host_id === session.playerId || room.guest_id === session.playerId;
      if (!isParticipant) {
        clearSession();
        setState({ status: "idle", room: null, playerId: null, isHost: false, error: null });
        return;
      }
      const isReady = room.status === "playing" || (room.status === "waiting" && room.guest_id);
      if (room.status === "playing" && room.turn_started_at) {
        const elapsed = (Date.now() - new Date(room.turn_started_at).getTime()) / 1000;
        if (elapsed > 15) {
          await resetTurnTimer(room.id);
          room.turn_started_at = new Date().toISOString();
        }
      }
      channelRef.current = subscribeToRoom(room.id, handleRoomUpdate);
      setState({
        status: isReady ? "ready" : "waiting",
        room,
        playerId: session.playerId,
        isHost: session.isHost,
        error: null,
      });
    } catch (e) {
      console.warn("Reconnect failed:", e);
      clearSession();
      setState({ status: "idle", room: null, playerId: null, isHost: false, error: null });
    }
  }, [handleRoomUpdate]);

  const initRan = useRef(false);
  useEffect(() => {
    if (initRan.current) return;
    initRan.current = true;

    const session = loadSession();
    if (session) {
      handleReconnect(session);
      return;
    }

    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const code = params.get("code");
    if (code) {
      const baseHash = window.location.hash.split("?")[0];
      window.history.replaceState(null, "", baseHash);
      handleJoin(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => cleanupChannel();
  }, []);

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
    cleanup: cleanupChannel,
  };
}
