import { useEffect } from "react";
import { useGame } from "../hooks/useGame";
import PlayerSearch from "./PlayerSearch";

export default function Game() {
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
    startGame,
    submitPlayer,
  } = useGame();

  useEffect(() => {
    startGame();
  }, [startGame]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="py-6 border-b border-gray-700">
        <h1 className="text-3xl font-bold text-center">Football Nerdle</h1>
        <p className="text-gray-400 text-center mt-1">Practice Mode</p>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-6">
        {/* Score & Timer */}
        <div className="flex gap-6 text-lg items-center">
          <div>
            Chain: <span className="text-green-400 font-bold">{score}</span>
          </div>
          <div>
            Best: <span className="text-yellow-400 font-bold">{bestStreak}</span>
          </div>
          {(status === "playing" || status === "checking") && (
            <div className={`font-mono font-bold text-2xl ${timeLeft <= 5 ? "text-red-400" : "text-white"}`}>
              {timeLeft}s
            </div>
          )}
        </div>

        {/* Chain display */}
        {chain.length > 1 && (
          <div className="w-full max-w-2xl overflow-x-auto">
            <div className="flex gap-2 items-center pb-2">
              {chain.map((p, i) => (
                <div key={`${p.id}-${i}`} className="flex items-center gap-2 shrink-0">
                  {i > 0 && <span className="text-gray-500">→</span>}
                  <div className="bg-gray-800 rounded-lg px-3 py-2 text-sm text-center">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-gray-400 text-xs">{p.nationality}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current player card */}
        {currentPlayer && status !== "gameover" && (
          <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 text-center max-w-sm w-full">
            {currentPlayer.thumbnail && (
              <img
                src={currentPlayer.thumbnail}
                alt={currentPlayer.name}
                className="w-24 h-24 rounded-full mx-auto mb-4 object-cover bg-gray-700"
              />
            )}
            <h2 className="text-2xl font-bold">{currentPlayer.name}</h2>
            <p className="text-gray-400">{currentPlayer.nationality}</p>
            {lastSharedClubs.length > 0 && (
              <p className="text-green-400 text-sm mt-2">
                Linked via: {lastSharedClubs.join(", ")}
              </p>
            )}
          </div>
        )}

        {/* Prompt */}
        {status === "playing" && (
          <p className="text-gray-300">
            Name a player who played with <span className="text-green-400 font-semibold">{currentPlayer?.name}</span>
          </p>
        )}

        {/* Search input */}
        {(status === "playing" || status === "checking") && (
          <PlayerSearch
            onSelect={submitPlayer}
            disabled={status === "checking"}
            usedPlayerIds={usedPlayerIds}
          />
        )}

        {status === "checking" && (
          <p className="text-yellow-400">Checking...</p>
        )}

        {status === "loading" && (
          <p className="text-gray-400">Starting game...</p>
        )}

        {/* Game Over */}
        {status === "gameover" && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-red-400 mb-2">Game Over!</h2>
            {timedOut ? (
              <p className="text-gray-300 mb-4">Time's up!</p>
            ) : wrongResult ? (
              <>
                <p className="text-gray-300 mb-4">
                  <span className="text-white font-semibold">{wrongResult.player.name}</span> didn't play with{" "}
                  <span className="text-white font-semibold">{currentPlayer?.name}</span>
                </p>
                <div className="text-sm text-gray-400 mb-4 text-left">
                  <p className="mb-1 font-medium text-gray-300">{currentPlayer?.name}'s clubs:</p>
                  <p className="mb-3">{wrongResult.checkedClubs.a.join(", ") || "None found"}</p>
                  <p className="mb-1 font-medium text-gray-300">{wrongResult.player.name}'s clubs:</p>
                  <p>{wrongResult.checkedClubs.b.join(", ") || "None found"}</p>
                </div>
              </>
            ) : null}
            <p className="text-lg mb-2">
              Final score: <span className="text-green-400 font-bold">{score}</span>
            </p>
            {score >= bestStreak && score > 0 && (
              <p className="text-yellow-400 text-sm mb-2">New best streak!</p>
            )}
            <p className="text-sm text-gray-400 mb-4">
              Best: <span className="text-yellow-400 font-bold">{bestStreak}</span>
            </p>
            <button
              onClick={startGame}
              className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition-colors"
            >
              Play Again
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
