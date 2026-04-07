import { Link, useNavigate } from "react-router-dom";
import { useGame } from "./useGame";
import PlayerSearch from "../../components/PlayerSearch";

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
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="py-6 border-b border-gray-700">
        <h1 className="text-3xl font-bold text-center">Football Nerdle</h1>
        <p className="text-gray-400 text-center mt-1">Battle Mode</p>
        <div className="text-center mt-2">
          <Link to="/" className="text-green-400 hover:text-green-300 text-sm">
            ← Back to Home
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-6">
        {/* Mode selection */}
        {status === "idle" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 max-w-sm w-full">
            <p className="text-gray-300 text-lg text-center">
              Name footballers who played together to build the longest chain.
              15 seconds per turn.
            </p>
            {bestStreak > 0 && (
              <p className="text-gray-400">
                Best streak: <span className="text-yellow-400 font-bold">{bestStreak}</span>
              </p>
            )}
            <button
              onClick={startGame}
              className="w-full px-6 py-4 bg-green-600 hover:bg-green-500 rounded-lg text-xl font-semibold transition-colors"
            >
              Practice
            </button>
            <button
              onClick={() => navigate("/battle/multiplayer")}
              className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-xl font-semibold transition-colors"
            >
              Play with a Friend
            </button>
          </div>
        )}

        {status === "loading" && (
          <p className="text-gray-400">Starting game...</p>
        )}

        {/* In-game UI */}
        {(status === "playing" || status === "checking") && (
          <>
            {/* Score & Timer */}
            <div className="flex gap-6 text-lg items-center">
              <div>
                Chain: <span className="text-green-400 font-bold">{score}</span>
              </div>
              <div>
                Best: <span className="text-yellow-400 font-bold">{bestStreak}</span>
              </div>
              <div
                className={`font-mono font-bold text-2xl ${timeLeft <= 5 ? "text-red-400" : "text-white"}`}
                aria-label={`${timeLeft} seconds remaining`}
                aria-live={timeLeft <= 5 ? "assertive" : "off"}
              >
                {timeLeft}s
              </div>
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
            {currentPlayer && (
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

            {/* Error */}
            {error && (
              <div role="alert" className="bg-orange-900/30 border border-orange-700 rounded-lg px-4 py-3 max-w-md w-full text-center text-orange-300 text-sm">
                {error}
              </div>
            )}

            {/* Prompt */}
            {status === "playing" && (
              <p className="text-gray-300">
                Name a player who played with <span className="text-green-400 font-semibold">{currentPlayer?.name}</span>
              </p>
            )}

            <PlayerSearch
              onSelect={submitPlayer}
              disabled={status === "checking"}
              usedPlayerIds={usedPlayerIds}
            />

            {status === "checking" && (
              <p className="text-yellow-400">Checking...</p>
            )}
          </>
        )}

        {/* Game Over */}
        {status === "gameover" && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-red-400 mb-2">Game Over!</h2>
            {error && !timedOut && !wrongResult ? (
              <p className="text-orange-300 mb-4">{error}</p>
            ) : timedOut ? (
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
