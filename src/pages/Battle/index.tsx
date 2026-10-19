import { useNavigate } from "react-router-dom";
import { Flame, RotateCcw, UserRound, Users, Zap } from "lucide-react";
import { useGame } from "./useGame";
import AppShell from "../../components/AppShell";
import CurrentLinkCard from "../../components/CurrentLinkCard";
import PageHeader from "../../components/PageHeader";
import PlayerChain from "../../components/PlayerChain";
import PlayerSearch from "../../components/PlayerSearch";
import TurnTimer from "../../components/TurnTimer";
import { TURN_TIME } from "../../constants";
import { ALERT_WARN, BTN_GOLD, BTN_LG, BTN_SECONDARY, PANEL, SECTION_LABEL } from "../../theme";

export default function Battle() {
  const navigate = useNavigate();
  const {
    chain,
    currentPlayer,
    score,
    status,
    lastSharedClubs,
    wrongResult,
    usedPlayerIds,
    bestStreak,
    timeLeft,
    timedOut,
    error,
    startGame,
    submitPlayer,
  } = useGame();

  return (
    <AppShell>
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <PageHeader title="Battle Mode" icon={Zap} accent="gold" />

        {/* Mode selection */}
        {status === "idle" && (
          <section className={`${PANEL} shadow-stadium p-6 sm:p-8 flex flex-col items-center text-center gap-6`}>
            <span className="w-16 h-16 rounded-2xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-gold-400">
              <Zap className="w-8 h-8" aria-hidden="true" />
            </span>
            <p className="text-slate-300 text-base sm:text-lg max-w-md">
              Name footballers who played together to build the longest chain.
              15 seconds per turn.
            </p>
            {bestStreak > 0 && (
              <p className="px-4 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-sm font-semibold">
                Best streak: <span className="text-gold-400 font-bold">{bestStreak}</span>
              </p>
            )}
            <div className="grid sm:grid-cols-2 gap-3 w-full max-w-md">
              <button onClick={startGame} className={`${BTN_GOLD} ${BTN_LG} text-base`}>
                <UserRound className="w-5 h-5" aria-hidden="true" />
                Practice
              </button>
              <button onClick={() => navigate("/battle/multiplayer")} className={`${BTN_SECONDARY} ${BTN_LG} text-base`}>
                <Users className="w-5 h-5 text-gold-400" aria-hidden="true" />
                Play with a Friend
              </button>
            </div>
          </section>
        )}

        {status === "loading" && (
          <p className="text-slate-400 text-center py-10">Starting game...</p>
        )}

        {/* In-game UI */}
        {(status === "playing" || status === "checking") && (
          <>
            <section className={`${PANEL} shadow-stadium p-5 sm:p-6 flex flex-col items-center text-center gap-5`}>
              <TurnTimer timeLeft={timeLeft} total={TURN_TIME} />

              <div className="flex flex-wrap justify-center items-center gap-3">
                <div className="px-4 py-1.5 rounded-full bg-gold-500/10 border border-gold-500/30 text-gold-400 font-extrabold text-sm flex items-center gap-2">
                  <Flame className="w-4 h-4" aria-hidden="true" />
                  <span>Chain: <span className="text-white">{score}</span></span>
                </div>
                <div className="px-4 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-xs">
                  Best: <span className="text-pitch-400 font-bold">{bestStreak}</span>
                </div>
              </div>

              {currentPlayer && <CurrentLinkCard player={currentPlayer} sharedClubs={lastSharedClubs} />}

              {error && (
                <div role="alert" className={`${ALERT_WARN} max-w-md w-full`}>
                  {error}
                </div>
              )}

              <div className="w-full max-w-md space-y-3">
                {status === "playing" && (
                  <p className="text-sm text-slate-300">
                    Name a player who played with <span className="text-gold-400 font-semibold">{currentPlayer?.name}</span>
                  </p>
                )}

                <PlayerSearch
                  onSelect={submitPlayer}
                  disabled={status === "checking"}
                  usedPlayerIds={usedPlayerIds}
                />

                {status === "checking" && (
                  <p className="text-gold-400 text-sm font-semibold">Checking...</p>
                )}
              </div>
            </section>

            {chain.length > 1 && (
              <section className={`${PANEL} p-5`}>
                <h3 className={`${SECTION_LABEL} mb-3`}>Your chain</h3>
                <PlayerChain chain={chain} />
              </section>
            )}
          </>
        )}

        {/* Game Over */}
        {status === "gameover" && (
          <section className={`${PANEL} border-rose-500/30 p-6 sm:p-8 max-w-xl w-full mx-auto text-center`}>
            <h2 className="text-3xl font-extrabold text-rose-400 mb-2">Game Over!</h2>
            {error && !timedOut && !wrongResult ? (
              <p className="text-orange-300 mb-4">{error}</p>
            ) : timedOut ? (
              <p className="text-slate-300 mb-4">Time's up!</p>
            ) : wrongResult ? (
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
            ) : null}
            <p className="text-lg mb-2">
              Final score: <span className="text-gold-400 font-extrabold">{score}</span>
            </p>
            {score >= bestStreak && score > 0 && (
              <p className="text-gold-400 text-sm font-semibold mb-2">New best streak!</p>
            )}
            <p className="text-sm text-slate-400 mb-5">
              Best: <span className="text-gold-400 font-bold">{bestStreak}</span>
            </p>
            <button onClick={startGame} className={`${BTN_GOLD} ${BTN_LG}`}>
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Play Again
            </button>
          </section>
        )}
      </main>
    </AppShell>
  );
}
