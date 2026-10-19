import { useState, useEffect } from "react";
import { Check, Copy, Gamepad2, Users } from "lucide-react";
import { useMultiplayerRoom } from "./useMultiplayerRoom";
import MultiplayerGame from "./MultiplayerGame";
import AppShell from "../../components/AppShell";
import PageHeader from "../../components/PageHeader";
import { ALERT_WARN, BTN_GOLD, BTN_LG, BTN_SECONDARY, PANEL } from "../../theme";

export default function MultiplayerBattle() {
  const { status, room, playerId, isHost, error, createRoom, joinRoom, cleanup } =
    useMultiplayerRoom();
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);

  function handleCopyCode() {
    if (!room) return;
    const url = `${window.location.origin}${window.location.pathname}#/battle/multiplayer?code=${room.code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const [lobbyCleanedUp, setLobbyCleanedUp] = useState(false);
  useEffect(() => {
    if (status === "ready" && !lobbyCleanedUp) {
      cleanup();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- gates the game mount until the lobby channel is unsubscribed
      setLobbyCleanedUp(true);
    }
  }, [status, lobbyCleanedUp, cleanup]);

  if (status === "ready" && lobbyCleanedUp && room && playerId) {
    return (
      <MultiplayerGame room={room} playerId={playerId} isHost={isHost} />
    );
  }

  return (
    <AppShell>
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <PageHeader title="Multiplayer Battle" icon={Users} accent="gold" />

        <section className={`${PANEL} p-6 sm:p-8`}>
          <div className="max-w-md mx-auto flex flex-col items-center text-center gap-6">
            <span className="w-16 h-16 rounded-2xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400">
              <Gamepad2 className="w-8 h-8" aria-hidden="true" />
            </span>

            {(status === "idle" || status === "error") && (
              <>
                <p className="text-slate-300 text-base sm:text-lg">
                  Play against a friend! Create a room or join with a code.
                </p>

                <button onClick={createRoom} className={`${BTN_GOLD} ${BTN_LG} w-full text-base`}>
                  Create Room
                </button>

                <div className="w-full flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-800" />
                  <span className="text-slate-500 text-xs font-bold">OR</span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>

                <div className="w-full flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Enter code"
                    maxLength={6}
                    className="flex-1 min-w-0 px-4 py-3 bg-slate-900/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20 text-center text-xl tracking-widest font-mono font-bold"
                  />
                  <button
                    onClick={() => joinRoom(joinCode)}
                    disabled={joinCode.length < 6}
                    className={`${BTN_SECONDARY} px-6 py-3 text-sm`}
                  >
                    Join
                  </button>
                </div>

                {error && (
                  <div role="alert" className={`${ALERT_WARN} w-full`}>
                    {error}
                  </div>
                )}
              </>
            )}

            {status === "creating" && (
              <p className="text-slate-400">Creating room...</p>
            )}

            {status === "joining" && (
              <p className="text-slate-400">Joining room...</p>
            )}

            {status === "reconnecting" && (
              <p className="text-slate-400">Reconnecting to game...</p>
            )}

            {status === "waiting" && room && (
              <>
                <p className="text-slate-300 text-base sm:text-lg">
                  Waiting for opponent to join...
                </p>

                <div className="w-full p-4 rounded-xl bg-slate-900/80 border border-slate-700 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Room Code</p>
                    <p className="text-3xl font-mono font-extrabold tracking-widest text-gold-400">
                      {room.code}
                    </p>
                  </div>
                  <button onClick={handleCopyCode} className={`${BTN_SECONDARY} px-4 py-2 text-xs`}>
                    {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                    {copied ? "Copied!" : "Copy Invite Link"}
                  </button>
                </div>

                <div className="w-full p-4 rounded-xl glass-card border-slate-800 flex items-center gap-3">
                  <span className="relative flex w-3 h-3" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-pitch-500 opacity-75 animate-ping" />
                    <span className="relative inline-flex w-3 h-3 rounded-full bg-pitch-500" />
                  </span>
                  <span className="text-xs font-semibold text-slate-300">Listening for opponent...</span>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
