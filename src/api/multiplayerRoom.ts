import { supabase } from "./supabaseClient";
import type { GameRoom, PlayerWithTeams } from "../types";
import type { RealtimeChannel } from "@supabase/supabase-js";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateId(): string {
  return crypto.randomUUID();
}

export async function createRoom(): Promise<{ room: GameRoom; playerId: string; isHost: boolean }> {
  if (!supabase) throw new Error("Supabase not configured");

  const playerId = generateId();
  const code = generateCode();

  const { data, error } = await supabase
    .from("game_rooms")
    .insert({
      code,
      host_id: playerId,
      status: "waiting",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create room: ${error.message}`);
  return { room: data as GameRoom, playerId, isHost: true };
}

export async function joinRoom(code: string, existingPlayerId?: string): Promise<{ room: GameRoom; playerId: string; isHost: boolean }> {
  if (!supabase) throw new Error("Supabase not configured");

  const { data: room, error: findError } = await supabase
    .from("game_rooms")
    .select()
    .eq("code", code.toUpperCase())
    .single();

  if (findError || !room) throw new Error("Room not found");

  if (room.status !== "waiting") {
    if (existingPlayerId) {
      const isParticipant =
        room.host_id === existingPlayerId || room.guest_id === existingPlayerId;
      if (isParticipant) {
        const isHost = room.host_id === existingPlayerId;
        return { room: room as GameRoom, playerId: existingPlayerId, isHost };
      }
    }
    throw new Error("Room is no longer available");
  }

  if (room.guest_id) throw new Error("Room is full");

  const playerId = existingPlayerId || generateId();

  const { error: updateError } = await supabase
    .from("game_rooms")
    .update({ guest_id: playerId })
    .eq("id", room.id)
    .eq("status", "waiting")
    .is("guest_id", null);

  if (updateError) throw new Error("Failed to join room — it may already be full");

  const { data: updated, error: fetchError } = await supabase
    .from("game_rooms")
    .select()
    .eq("id", room.id)
    .single();

  if (fetchError || !updated) throw new Error("Failed to fetch room after joining");
  if (updated.guest_id !== playerId) throw new Error("Room is full");

  return { room: updated as GameRoom, playerId, isHost: false };
}

export async function resetTurnTimer(roomId: string): Promise<void> {
  if (!supabase) return;
  await supabase
    .from("game_rooms")
    .update({ turn_started_at: new Date().toISOString() })
    .eq("id", roomId)
    .eq("status", "playing");
}

export async function startGame(
  roomId: string,
  hostId: string,
  seedPlayer: PlayerWithTeams,
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  const { error } = await supabase
    .from("game_rooms")
    .update({
      status: "playing",
      chain: [seedPlayer],
      used_player_ids: [seedPlayer.id],
      last_shared_clubs: [],
      current_turn: hostId,
      turn_started_at: new Date().toISOString(),
      winner: null,
      lose_reason: null,
      score: 0,
    })
    .eq("id", roomId)
    .eq("host_id", hostId);

  if (error) throw new Error(`Failed to start game: ${error.message}`);
}

export async function submitTurn(
  roomId: string,
  myId: string,
  opponentId: string,
  newChain: PlayerWithTeams[],
  usedPlayerIds: string[],
  sharedClubs: string[],
): Promise<boolean> {
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("game_rooms")
    .update({
      chain: newChain,
      used_player_ids: usedPlayerIds,
      last_shared_clubs: sharedClubs,
      current_turn: opponentId,
      turn_started_at: new Date().toISOString(),
      score: newChain.length - 1,
    })
    .eq("id", roomId)
    .eq("current_turn", myId)
    .select()
    .single();

  if (error || !data) return false;
  return true;
}

export async function endGame(
  roomId: string,
  winnerId: string,
  loseReason: "wrong" | "timeout" | "disconnect",
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  await supabase
    .from("game_rooms")
    .update({
      status: "finished",
      winner: winnerId,
      lose_reason: loseReason,
    })
    .eq("id", roomId)
    .neq("status", "finished");
}

// Heartbeat: write last_seen timestamp for this player
export async function sendHeartbeat(roomId: string, isHost: boolean): Promise<void> {
  if (!supabase) return;
  const col = isHost ? "host_last_seen" : "guest_last_seen";
  await supabase
    .from("game_rooms")
    .update({ [col]: new Date().toISOString() })
    .eq("id", roomId);
}

export function subscribeToRoom(
  roomId: string,
  onUpdate: (room: GameRoom) => void,
): RealtimeChannel {
  if (!supabase) throw new Error("Supabase not configured");

  const channel = supabase.channel(`room:${roomId}`);

  channel.on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "game_rooms",
      filter: `id=eq.${roomId}`,
    },
    (payload) => {
      onUpdate(payload.new as GameRoom);
    },
  );

  channel.subscribe();

  return channel;
}

export async function getRoom(roomId: string): Promise<GameRoom | null> {
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("game_rooms")
    .select()
    .eq("id", roomId)
    .single();

  if (error || !data) return null;
  return data as GameRoom;
}
