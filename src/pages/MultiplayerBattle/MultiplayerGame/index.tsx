import { Link } from "react-router-dom";
import { Flame, Trophy, Users, X } from "lucide-react";
import { useMultiplayerGame } from "../useMultiplayerGame";
import { SESSION_KEY } from "../constants";
import AppShell from "../../../components/AppShell";
import CurrentLinkCard from "../../../components/CurrentLinkCard";
import PageHeader from "../../../components/PageHeader";
import PlayerChain from "../../../components/PlayerChain";
import PlayerSearch from "../../../components/PlayerSearch";
import TurnTimer from "../../../components/TurnTimer";
import { TURN_TIME } from "../../../constants";
import { ALERT_WARN, BTN_GOLD, BTN_LG, BTN_SECONDARY, PANEL, SECTION_LABEL } from "../../../theme";
import type { GameRoom } from "../../../types";

interface Props {
  room: GameRoom;
  playerId: string;
  isHost: boolean;
}

export default function MultiplayerGame({ room: initialRoom, playerId, isHost }: Props) {
  const {
    room,
    status,
    error,
    wrongResult,
    currentPlayer,
    isMyTurn,
    opponentConnected,
    timeLeft,
    startGame,
    submitPlayer,
  } = useMultiplayerGame(initialRoom, playerId, isHost);

  const chain = room.chain;
  const isFinished = status === "finished";
  const iWon = room.winner === playerId;
  const usedPlayerIds = new Set(room.used_player_ids);

  return (
    <AppShell>
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <PageHeader title={`Multiplayer Battle — Room ${room.code}`} icon={Users} accent="gold" />

        {status === "starting" && (
          <section className={`${PANEL} shadow-stadium p-6 sm:p-8 flex flex-col items-center text-center gap-4`}>
            <p className="text-slate-300 text-lg">Both players connected!</p>
            {isHost ? (
              <>
                {error && (
                  <div role="alert" className={`${ALERT_WARN} max-w-md w-full`}>
                    {error}
                  </div>
                )}
                <button onClick={startGame} className={`${BTN_GOLD} px-8 py-4 text-base`}>
                  Start Game
                </button>
              </>
            ) : (
              <p className="text-slate-400">Waiting for host to start...</p>
            )}
          </section>
        )}

        {(status === "playing" || status === "checking") && (
          <>
            <section className={`${PANEL} shadow-stadium p-5 sm:p-6 flex flex-col items-center text-center gap-5`}>
              <TurnTimer timeLeft={timeLeft} total={TURN_TIME} />

              <div className="flex flex-wrap justify-center items-center gap-3">
                <div className="px-4 py-1.5 rounded-full bg-gold-500/10 border border-gold-500/30 text-gold-400 font-extrabold text-sm flex items-center gap-2">
                  <Flame className="w-4 h-4" aria-hidden="true" />
                  <span>Chain: <span className="text-white">{room.score}</span></span>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-sm font-bold border ${
                  isMyTurn
                    ? "bg-pitch-500/15 border-pitch-500/50 text-pitch-300"
                    : "bg-slate-800 border-slate-700 text-slate-400"
                }`}>
                  {isMyTurn ? "Your turn!" : "Opponent's turn..."}
                </div>
              </div>

              {!opponentConnected && (
                <div className="bg-gold-500/10 border border-gold-500/40 rounded-xl px-4 py-2 max-w-md w-full text-center text-gold-300 text-sm">
                  Opponent disconnected — game paused, waiting up to 1 minute to reconnect...
                </div>
              )}

              {currentPlayer && <CurrentLinkCard player={currentPlayer} sharedClubs={room.last_shared_clubs} />}

              {error && (
                <div role="alert" className={`${ALERT_WARN} max-w-md w-full`}>
                  {error}
                </div>
              )}

              {isMyTurn && status === "playing" && (
                <div className="w-full max-w-md space-y-3">
                  <p className="text-sm text-slate-300">
                    Name a player who played with{" "}
                    <span className="text-gold-400 font-semibold">
                      {currentPlayer?.name}
                    </span>
                  </p>
                  <PlayerSearch
                    onSelect={submitPlayer}
                    disabled={status !== "playing"}
                    usedPlayerIds={usedPlayerIds}
                  />
                </div>
              )}

              {status === "checking" && (
                <p className="text-gold-400 text-sm font-semibold">Checking...</p>
              )}
            </section>

            {chain.length > 1 && (
              <section className={`${PANEL} p-5`}>
                <h3 className={`${SECTION_LABEL} mb-3`}>Chain</h3>
                <PlayerChain chain={chain} />
              </section>
            )}
          </>
        )}

        {isFinished && (
          <section className={`${PANEL} ${iWon ? "border-pitch-500/30 shadow-stadium" : "border-rose-500/30"} p-6 sm:p-8 max-w-xl w-full mx-auto text-center`}>
            <span
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 border ${
                iWon
                  ? "bg-pitch-500/20 text-pitch-400 border-pitch-500/40"
                  : "bg-rose-500/20 text-rose-400 border-rose-500/40"
              }`}
            >
              {iWon ? <Trophy className="w-8 h-8" aria-hidden="true" /> : <X className="w-8 h-8" aria-hidden="true" />}
            </span>
            <h2 className={`text-3xl font-extrabold mb-2 ${iWon ? "text-pitch-400" : "text-rose-400"}`}>
              {iWon ? "You Win!" : "You Lose!"}
            </h2>

            {room.lose_reason === "timeout" && (
              <p className="text-slate-300 mb-4">
                {iWon ? "Your opponent ran out of time!" : "Time's up!"}
              </p>
            )}

            {room.lose_reason === "wrong" && wrongResult && (
              <>
                <p className="text-slate-300 mb-4">
                  <span className="text-white font-semibold">{wrongResult.player.name}</span> didn't play with{" "}
                  <span className="text-white font-semibold">{currentPlayer?.name}</span>
                </p>
                <div className="glass-card border-slate-800 rounded-xl p-4 text-sm text-slate-400 mb-4 text-left">
                  <p className="mb-1 font-semibold text-slate-300">{currentPlayer?.name}'s clubs:</p>
                  <p className="mb-3">{wrongResult.checkedClubs.a.join(", ") || "None found"}</p>
                  <p className="mb-1 font-semibold text-slate-300">{wrongResult.player.name}'s clubs:</p>
                  <p>{wrongResult.checkedClubs.b.join(", ") || "None found"}</p>
                </div>
              </>
            )}

            {room.lose_reason === "wrong" && !wrongResult && (
              <p className="text-slate-300 mb-4">
                Your opponent picked the wrong player!
              </p>
            )}

            {room.lose_reason === "disconnect" && (
              <p className="text-slate-300 mb-4">
                {iWon ? "Your opponent disconnected." : "You disconnected."}
              </p>
            )}

            <p className="text-lg mb-3">
              Chain length: <span className="text-gold-400 font-extrabold">{room.score}</span>
            </p>

            {chain.length > 1 && (
              <div className="mb-5">
                <PlayerChain chain={chain} compact />
              </div>
            )}

            <div className="flex flex-wrap gap-3 justify-center items-center">
              {isHost ? (
                <button onClick={startGame} className={`${BTN_GOLD} ${BTN_LG}`}>
                  Rematch
                </button>
              ) : (
                <p className="text-slate-400 text-sm">Waiting for host to rematch...</p>
              )}
              <Link
                to="/battle/multiplayer"
                className={`${BTN_SECONDARY} ${BTN_LG}`}
                onClick={() => {
                  localStorage.removeItem(SESSION_KEY);
                  window.location.reload();
                }}
              >
                New Room
              </Link>
            </div>
          </section>
        )}
      </main>
    </AppShell>
  );
}
