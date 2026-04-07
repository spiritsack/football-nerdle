import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGuessGame } from "./useGuessGame";
import { HARD_MODE_KEY } from "./constants";
import { mergeConsecutiveClubs, getTodayString } from "./helpers";
import PlayerCard from "../../components/PlayerCard";

export default function GuessThePlayer() {
  const navigate = useNavigate();
  const {
    targetPlayer,
    clubs,
    attempts,
    maxAttempts,
    status,
    wrongGuesses,
    error,
    isDaily,
    isArchive,
    dayNumber,
    today,
    stats,
    hints,
    startDaily,
    startRandom,
    loadArchiveDay,
    submitGuess,
    getShareText,
  } = useGuessGame();

  const [hardModeDisabled] = useState(() => {
    try {
      const stored = localStorage.getItem(HARD_MODE_KEY);
      if (!stored) return false;
      const parsed = JSON.parse(stored);
      return parsed.date === getTodayString();
    } catch {
      return false;
    }
  });
  const [hardMode, setHardMode] = useState(!hardModeDisabled);
  const [copied, setCopied] = useState(false);

  function toggleHardMode() {
    if (hardMode) {
      localStorage.setItem(HARD_MODE_KEY, JSON.stringify({ date: getTodayString() }));
      setHardMode(false);
    }
  }

  function handlePlayToday() {
    window.location.hash = "#/guess";
    startDaily();
  }

  function handleShare() {
    const text = getShareText(hardMode);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const mergedClubs = useMemo(() => mergeConsecutiveClubs(clubs), [clubs]);
  const resultScreen = (status === "won" || status === "lost") && targetPlayer;

  const todayDayNum = Math.floor((new Date(today).getTime() - new Date("2026-03-24").getTime()) / 86400000) + 1;

  const dayNavigation = (isDaily || isArchive) && dayNumber ? (
    <div className="flex items-center gap-6 text-sm text-gray-500">
      {dayNumber > 1 && (
        <button onClick={() => loadArchiveDay(dayNumber - 1)} className="hover:text-gray-300 transition-colors">
          ‹ Previous day
        </button>
      )}
      {isArchive && (
        <button
          onClick={() => dayNumber < todayDayNum ? loadArchiveDay(dayNumber + 1) : navigate("/guess")}
          className="hover:text-gray-300 transition-colors"
        >
          Next day ›
        </button>
      )}
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="py-6 border-b border-gray-700">
        <h1 className="text-3xl font-bold text-center">Football Nerdle</h1>
        <p className="text-gray-400 text-center mt-1">
          {isArchive ? `Archive — Daily #${dayNumber}` : isDaily ? `Guess the Player — Daily #${dayNumber}` : "Guess the Player"}
        </p>
        <div className="flex items-center justify-center gap-4 mt-2">
          <Link to="/" className="text-green-400 hover:text-green-300 text-sm">
            ← Back to Home
          </Link>
          <Link to="/guess/archive" className="text-gray-500 hover:text-gray-300 text-sm">
            Archive
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-6">
        {isArchive && (
          <div className="w-full max-w-md bg-amber-900/40 border border-amber-600 rounded-lg px-4 py-3 text-center">
            <p className="text-amber-300 text-sm font-medium">
              This is an archived puzzle (Daily #{dayNumber})
            </p>
            <button
              onClick={handlePlayToday}
              className="mt-2 px-4 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-semibold text-white transition-colors"
            >
              Play Today's Daily
            </button>
          </div>
        )}

        {status === "playing" && (
          <div className="flex items-center gap-2">
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
            <div className="relative group">
              <button
                type="button"
                aria-label={hardMode
                ? "Hard mode info: only club badges shown, no names or years. Can only be turned off once per day."
                : "Hard mode info: hard mode is off for today. Resets tomorrow."}
                className="text-gray-500 hover:text-gray-300 focus:text-gray-300 text-sm select-none focus:outline-none"
              >
                ⓘ
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 bg-gray-700 text-gray-200 text-xs rounded-lg shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity text-center z-10">
                {hardMode
                  ? "Only club badges shown — no names or years. Can only be turned off once per day."
                  : "Hard mode is off for today. Resets tomorrow."}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-700" />
              </div>
            </div>
          </div>
        )}

        {status === "loading" && (
          <p className="text-gray-400">Loading player...</p>
        )}

        {status === "idle" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            {error && (
              <div role="alert" className="bg-orange-900/30 border border-orange-700 rounded-lg px-4 py-3 max-w-md w-full text-center text-orange-300 text-sm">
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

        {status === "playing" && targetPlayer && (
          <>
            <div className="text-lg">
              Attempts: <span className={`font-bold ${attempts >= maxAttempts - 1 ? "text-red-400" : "text-green-400"}`}>{attempts}</span>
              <span className="text-gray-500"> / {maxAttempts}</span>
            </div>

            <p className="text-gray-300">Which player is this?</p>

            <PlayerCard
              player={targetPlayer}
              clubs={mergedClubs}
              hints={hints}
              revealed={false}
              hardMode={hardMode}
              onGuess={submitGuess}
            />

            {wrongGuesses.length > 0 && (
              <div className="text-sm text-gray-400">
                Wrong: {wrongGuesses.map((p) => p.name).join(", ")}
              </div>
            )}

            {error && (
              <div role="alert" className="bg-orange-900/30 border border-orange-700 rounded-lg px-4 py-3 max-w-md w-full text-center text-orange-300 text-sm">
                {error}
              </div>
            )}

            {dayNavigation}
          </>
        )}

        {resultScreen && targetPlayer && (
          <>
            <h2 className={`text-2xl font-bold ${status === "won" ? "text-green-400" : "text-red-400"}`}>
              {status === "won" ? "Correct!" : "Game Over!"}
            </h2>

            <PlayerCard
              player={targetPlayer}
              clubs={mergedClubs}
              hints={hints}
              revealed={true}
              hardMode={false}
              result={status === "won" ? "won" : "lost"}
            />

            <p className="text-gray-300">
              {status === "won" ? (
                <>Guessed in <span className="text-green-400 font-bold">{attempts}</span> {attempts === 1 ? "attempt" : "attempts"}</>
              ) : (
                <span className="text-red-400">Not guessed</span>
              )}
            </p>

            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={handleShare}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors"
              >
                {copied ? "Copied!" : "Share Result"}
              </button>
              {isArchive ? (
                <button
                  onClick={handlePlayToday}
                  className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition-colors"
                >
                  Play Today's Daily
                </button>
              ) : (
                <button
                  onClick={startRandom}
                  className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition-colors"
                >
                  Random Game
                </button>
              )}
            </div>

            {dayNavigation}

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

      {targetPlayer && (
        <footer className="py-4 text-center space-y-1">
          {targetPlayer.cachedAt && (
            <p className="text-gray-600 text-xs">
              Data updated: {new Date(targetPlayer.cachedAt).toLocaleDateString("en-GB")}
            </p>
          )}
          {(status === "won" || status === "lost") && (
            <p className="text-gray-600 text-xs">
              Player ID: {targetPlayer.id}
            </p>
          )}
          {(status === "won" || status === "lost") && (
            <a
              href={`https://github.com/spiritsack/football-nerdle/issues/new?title=${encodeURIComponent(`Data error: ${targetPlayer.name}`)}&body=${encodeURIComponent(`**Player:** ${targetPlayer.name} (ID: ${targetPlayer.id})\n**Clubs shown:**\n${clubs.map((c) => `- ${c.teamName} ${c.yearJoined}${c.yearDeparted ? ` – ${c.yearDeparted}` : " – present"}`).join("\n")}\n\n**What's wrong:**\n`)}&labels=data-error`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-300 text-xs underline"
            >
              Report data error
            </a>
          )}
        </footer>
      )}
    </div>
  );
}
