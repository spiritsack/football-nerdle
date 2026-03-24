import { useState } from "react";
import { Link } from "react-router-dom";
import { useGuessGame } from "../hooks/useGuessGame";
import PlayerSearch from "./PlayerSearch";

export default function GuessGame() {
  const {
    targetPlayer,
    clubs,
    attempts,
    maxAttempts,
    status,
    wrongGuesses,
    error,
    startGame,
    submitGuess,
  } = useGuessGame();

  const [hardMode, setHardMode] = useState(false);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="py-6 border-b border-gray-700">
        <h1 className="text-3xl font-bold text-center">Football Nerdle</h1>
        <p className="text-gray-400 text-center mt-1">Guess the Player</p>
        <div className="text-center mt-2">
          <Link to="/" className="text-green-400 hover:text-green-300 text-sm">
            ← Back to Home
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-6">
        {/* Hard mode toggle */}
        <button
          onClick={() => setHardMode((h) => !h)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            hardMode
              ? "bg-red-600 hover:bg-red-500 text-white"
              : "bg-gray-700 hover:bg-gray-600 text-gray-300"
          }`}
        >
          Hard Mode: {hardMode ? "ON" : "OFF"}
        </button>

        {status === "loading" && (
          <p className="text-gray-400">Loading player...</p>
        )}

        {/* Playing */}
        {status === "playing" && (
          <>
            {/* Attempts */}
            <div className="text-lg">
              Attempts: <span className={`font-bold ${attempts >= maxAttempts - 1 ? "text-red-400" : "text-green-400"}`}>{attempts}</span>
              <span className="text-gray-500"> / {maxAttempts}</span>
            </div>

            {/* Club history */}
            <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 max-w-md w-full">
              <h2 className="text-lg font-semibold mb-4 text-center text-gray-300">Club History</h2>
              <div className="space-y-2">
                {clubs.map((club, i) => (
                  <div
                    key={`${club.teamId}-${i}`}
                    className="flex items-center gap-3 bg-gray-700 rounded-lg px-4 py-2"
                  >
                    {club.badge ? (
                      <img src={club.badge} alt="" className="w-8 h-8 object-contain" />
                    ) : (
                      <div className="w-8 h-8 bg-gray-600 rounded" />
                    )}
                    {!hardMode && (
                      <>
                        <span className="font-medium">{club.teamName}</span>
                        <span className="text-gray-400 text-sm ml-auto">
                          {club.yearJoined}{club.yearDeparted ? ` – ${club.yearDeparted}` : " – present"}
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Wrong guesses */}
            {wrongGuesses.length > 0 && (
              <div className="text-sm text-gray-400">
                Wrong: {wrongGuesses.map((p) => p.name).join(", ")}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-orange-900/30 border border-orange-700 rounded-lg px-4 py-3 max-w-md w-full text-center text-orange-300 text-sm">
                {error}
              </div>
            )}

            <p className="text-gray-300">Who is this player?</p>

            <PlayerSearch onSelect={submitGuess} />
          </>
        )}

        {/* Won */}
        {status === "won" && targetPlayer && (
          <div className="bg-green-900/30 border border-green-700 rounded-xl p-6 max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-green-400 mb-4">Correct!</h2>
            {targetPlayer.thumbnail && (
              <img
                src={targetPlayer.thumbnail}
                alt={targetPlayer.name}
                className="w-24 h-24 rounded-full mx-auto mb-4 object-cover bg-gray-700"
              />
            )}
            <p className="text-xl font-bold mb-1">{targetPlayer.name}</p>
            <p className="text-gray-400 mb-4">{targetPlayer.nationality}</p>
            <p className="text-gray-300 mb-4">
              Guessed in <span className="text-green-400 font-bold">{attempts + 1}</span> {attempts === 0 ? "attempt" : "attempts"}
              {hardMode && <span className="text-red-400 ml-1">(Hard)</span>}
            </p>
            <button
              onClick={startGame}
              className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition-colors"
            >
              Play Again
            </button>
          </div>
        )}

        {/* Lost */}
        {status === "lost" && targetPlayer && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Game Over!</h2>
            <p className="text-gray-300 mb-4">The player was:</p>
            {targetPlayer.thumbnail && (
              <img
                src={targetPlayer.thumbnail}
                alt={targetPlayer.name}
                className="w-24 h-24 rounded-full mx-auto mb-4 object-cover bg-gray-700"
              />
            )}
            <p className="text-xl font-bold mb-1">{targetPlayer.name}</p>
            <p className="text-gray-400 mb-6">{targetPlayer.nationality}</p>
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
