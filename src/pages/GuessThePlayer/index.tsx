import { useState } from "react";
import { Link } from "react-router-dom";
import { useGuessGame } from "./useGuessGame";
import { HARD_MODE_KEY } from "./constants";
import PlayerSearch from "../../components/PlayerSearch";

export default function GuessThePlayer() {
  const {
    targetPlayer,
    clubs,
    attempts,
    maxAttempts,
    status,
    wrongGuesses,
    error,
    isDaily,
    dayNumber,
    stats,
    startDaily,
    startRandom,
    submitGuess,
    getShareText,
  } = useGuessGame();

  const [hardModeDisabled] = useState(() => {
    try {
      const stored = localStorage.getItem(HARD_MODE_KEY);
      if (!stored) return false;
      const parsed = JSON.parse(stored);
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return parsed.date === today;
    } catch {
      return false;
    }
  });
  const [hardMode, setHardMode] = useState(!hardModeDisabled);
  const [copied, setCopied] = useState(false);

  function toggleHardMode() {
    if (hardMode) {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      localStorage.setItem(HARD_MODE_KEY, JSON.stringify({ date: today }));
      setHardMode(false);
    }
  }

  function handleShare() {
    const text = getShareText(hardMode);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const resultScreen = (status === "won" || status === "lost") && targetPlayer;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="py-6 border-b border-gray-700">
        <h1 className="text-3xl font-bold text-center">Football Nerdle</h1>
        <p className="text-gray-400 text-center mt-1">
          Guess the Player {isDaily && `— Daily #${dayNumber}`}
        </p>
        <div className="text-center mt-2">
          <Link to="/" className="text-green-400 hover:text-green-300 text-sm">
            ← Back to Home
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-6">
        {status === "playing" && (
          <button
            onClick={toggleHardMode}
            disabled={!hardMode}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              hardMode
                ? "bg-red-600 hover:bg-red-500 text-white"
                : "bg-gray-700 text-gray-500 cursor-not-allowed"
            }`}
          >
            Hard Mode: {hardMode ? "ON" : "OFF"}
          </button>
        )}

        {status === "loading" && (
          <p className="text-gray-400">Loading player...</p>
        )}

        {status === "idle" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            {error && (
              <div className="bg-orange-900/30 border border-orange-700 rounded-lg px-4 py-3 max-w-md w-full text-center text-orange-300 text-sm">
                {error}
              </div>
            )}
            <button
              onClick={startDaily}
              className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {status === "playing" && (
          <>
            <div className="text-lg">
              Attempts: <span className={`font-bold ${attempts >= maxAttempts - 1 ? "text-red-400" : "text-green-400"}`}>{attempts}</span>
              <span className="text-gray-500"> / {maxAttempts}</span>
            </div>

            <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 max-w-md w-full">
              <h2 className="text-lg font-semibold mb-4 text-center text-gray-300">Club History</h2>
              {hardMode ? (
                <div className="flex flex-col md:flex-row items-center justify-center gap-1 flex-wrap">
                  {clubs.map((club, i) => (
                    <div key={`${club.teamId}-${i}`} className="flex flex-col md:flex-row items-center">
                      {i > 0 && (
                        <>
                          <span className="text-gray-500 text-lg md:hidden">↓</span>
                          <span className="text-gray-500 text-lg hidden md:block mx-1">→</span>
                        </>
                      )}
                      {club.badge ? (
                        <img src={club.badge} alt="" className="w-16 h-16 object-contain" />
                      ) : (
                        <div className="w-16 h-16 bg-gray-600 rounded flex items-center justify-center text-xs text-gray-300 text-center p-1 leading-tight">{club.teamName}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {clubs.map((club, i) => (
                    <div key={`${club.teamId}-${i}`}>
                      {i > 0 && <div className="text-gray-500 text-center text-sm">↓</div>}
                      <div className="flex items-center gap-3 bg-gray-700 rounded-lg px-4 py-2">
                        {club.badge ? (
                          <img src={club.badge} alt="" className="w-8 h-8 object-contain" />
                        ) : (
                          <div className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center text-[0.5rem] text-gray-300 text-center p-0.5 leading-tight">{club.teamName}</div>
                        )}
                        <span className="font-medium">{club.teamName}</span>
                        <span className="text-gray-400 text-sm ml-auto">
                          {club.yearJoined}{club.yearDeparted ? ` – ${club.yearDeparted}` : " – present"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {wrongGuesses.length > 0 && (
              <div className="text-sm text-gray-400">
                Wrong: {wrongGuesses.map((p) => p.name).join(", ")}
              </div>
            )}

            {error && (
              <div className="bg-orange-900/30 border border-orange-700 rounded-lg px-4 py-3 max-w-md w-full text-center text-orange-300 text-sm">
                {error}
              </div>
            )}

            <p className="text-gray-300">Who is this player?</p>

            <PlayerSearch onSelect={submitGuess} />
          </>
        )}

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
              Guessed in <span className="text-green-400 font-bold">{attempts}</span> {attempts === 1 ? "attempt" : "attempts"}
              {hardMode && <span className="text-red-400 ml-1">(Hard)</span>}
            </p>
          </div>
        )}

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
          </div>
        )}

        {resultScreen && (
          <>
            <div className="flex gap-3">
              <button
                onClick={handleShare}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors"
              >
                {copied ? "Copied!" : "Share Result"}
              </button>
              <button
                onClick={startRandom}
                className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition-colors"
              >
                Random Game
              </button>
            </div>

            <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-center text-gray-300 mb-4">Your Stats</h3>
              <div className="grid grid-cols-5 gap-2 text-center">
                <div>
                  <div className="text-2xl font-bold">{stats.played}</div>
                  <div className="text-gray-400 text-xs">Played</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">{stats.won}</div>
                  <div className="text-gray-400 text-xs">Won</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-400">{stats.lost}</div>
                  <div className="text-gray-400 text-xs">Lost</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-400">{stats.streak}</div>
                  <div className="text-gray-400 text-xs">Streak</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-400">{stats.longestStreak}</div>
                  <div className="text-gray-400 text-xs">Best</div>
                </div>
              </div>
              {stats.played > 0 && (
                <div className="mt-3 text-center text-gray-400 text-sm">
                  Win rate: {Math.round((stats.won / stats.played) * 100)}%
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {targetPlayer && (status === "won" || status === "lost") && (
        <footer className="py-4 text-center">
          <a
            href={`https://github.com/spiritsack/football-nerdle/issues/new?title=${encodeURIComponent(`Data error: ${targetPlayer.name}`)}&body=${encodeURIComponent(`**Player:** ${targetPlayer.name} (ID: ${targetPlayer.id})\n**Clubs shown:**\n${clubs.map((c) => `- ${c.teamName} ${c.yearJoined}${c.yearDeparted ? ` – ${c.yearDeparted}` : " – present"}`).join("\n")}\n\n**What's wrong:**\n`)}&labels=data-error`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-300 text-xs underline"
          >
            Report data error
          </a>
        </footer>
      )}
    </div>
  );
}
