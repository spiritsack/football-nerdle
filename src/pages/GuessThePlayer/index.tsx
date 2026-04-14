import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGuessGame } from "./useGuessGame";
import { HARD_MODE_KEY } from "./constants";
import { mergeConsecutiveClubs, getTodayString } from "./helpers";
import PlayerCard from "../../components/PlayerCard";
import { getLastRefresh } from "../../api/playerCache";
import PageLayout from "../../components/PageLayout";
import PageHeader from "../../components/PageHeader";
import Button from "../../components/Button";
import Card from "../../components/Card";
import Alert from "../../components/Alert";

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
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  useEffect(() => {
    getLastRefresh().then(setLastRefresh);
  }, []);

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
    <div className="flex items-center gap-6 text-sm text-text-subtle">
      {dayNumber > 1 && (
        <button onClick={() => loadArchiveDay(dayNumber - 1)} className="hover:text-text-secondary transition-colors">
          ‹ Previous day
        </button>
      )}
      {isArchive && (
        <button
          onClick={() => dayNumber < todayDayNum ? loadArchiveDay(dayNumber + 1) : navigate("/guess")}
          className="hover:text-text-secondary transition-colors"
        >
          Next day ›
        </button>
      )}
    </div>
  ) : null;

  const subtitle = isArchive
    ? `Archive — Daily #${dayNumber}`
    : isDaily
      ? `Guess the Player — Daily #${dayNumber}`
      : "Guess the Player";

  return (
    <PageLayout>
      <PageHeader
        subtitle={subtitle}
        links={[
          { to: "/", label: "← Back to Home" },
          { to: "/guess/archive", label: "Archive", accent: false },
        ]}
      />

      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-6">
        {isArchive && (
          <Alert variant="warning" className="w-full max-w-md">
            <p className="font-medium">
              This is an archived puzzle (Daily #{dayNumber})
            </p>
            <Button
              onClick={handlePlayToday}
              size="sm"
              className="mt-2"
            >
              Play Today's Daily
            </Button>
          </Alert>
        )}

        {status === "playing" && (
          <div className="flex items-center gap-2">
            <button
              onClick={toggleHardMode}
              disabled={!hardMode}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                hardMode
                  ? "bg-danger hover:bg-danger-hover text-white"
                  : "bg-surface-input text-text-subtle cursor-not-allowed"
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
                className="text-text-subtle hover:text-text-secondary focus:text-text-secondary text-sm select-none focus:outline-none"
              >
                ⓘ
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 bg-surface-input text-gray-200 text-xs rounded-lg shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity text-center z-10">
                {hardMode
                  ? "Only club badges shown — no names or years. Can only be turned off once per day."
                  : "Hard mode is off for today. Resets tomorrow."}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-input" />
              </div>
            </div>
          </div>
        )}

        {status === "loading" && (
          <p className="text-text-muted">Loading player...</p>
        )}

        {status === "idle" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            {error && (
              <Alert className="max-w-md w-full">{error}</Alert>
            )}
            <Button onClick={startDaily}>Try Again</Button>
          </div>
        )}

        {status === "playing" && targetPlayer && (
          <>
            <div className="text-lg">
              Attempts: <span className={`font-bold ${attempts >= maxAttempts - 1 ? "text-error" : "text-success"}`}>{attempts}</span>
              <span className="text-text-subtle"> / {maxAttempts}</span>
            </div>

            <p className="text-text-secondary">Which player is this?</p>

            <PlayerCard
              player={targetPlayer}
              clubs={mergedClubs}
              hints={hints}
              revealed={false}
              hardMode={hardMode}
              onGuess={submitGuess}
            />

            {wrongGuesses.length > 0 && (
              <div className="text-sm text-text-muted">
                Wrong: {wrongGuesses.map((p) => p.name).join(", ")}
              </div>
            )}

            {error && (
              <Alert className="max-w-md w-full">{error}</Alert>
            )}

            {dayNavigation}
          </>
        )}

        {resultScreen && targetPlayer && (
          <>
            <h2 className={`text-2xl font-bold ${status === "won" ? "text-success" : "text-error"}`}>
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

            <p className="text-text-secondary">
              {status === "won" ? (
                <>Guessed in <span className="text-success font-bold">{attempts}</span> {attempts === 1 ? "attempt" : "attempts"}</>
              ) : (
                <span className="text-error">Not guessed</span>
              )}
            </p>

            <div className="flex gap-3 flex-wrap justify-center">
              <Button onClick={handleShare} variant="secondary">
                {copied ? "Copied!" : "Share Result"}
              </Button>
              {isArchive ? (
                <Button onClick={handlePlayToday}>
                  Play Today's Daily
                </Button>
              ) : (
                <Button onClick={startRandom}>
                  Random Game
                </Button>
              )}
            </div>

            {dayNavigation}

            <Card className="max-w-md w-full">
              <h3 className="text-lg font-semibold text-center text-text-secondary mb-4">Your Stats</h3>
              <div className="grid grid-cols-5 gap-2 text-center">
                <div>
                  <div className="text-2xl font-bold">{stats.played}</div>
                  <div className="text-text-muted text-xs">Played</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-success">{stats.won}</div>
                  <div className="text-text-muted text-xs">Won</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-error">{stats.lost}</div>
                  <div className="text-text-muted text-xs">Lost</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-warning">{stats.streak}</div>
                  <div className="text-text-muted text-xs">Streak</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-warning">{stats.longestStreak}</div>
                  <div className="text-text-muted text-xs">Best</div>
                </div>
              </div>
              {stats.played > 0 && (
                <div className="mt-3 text-center text-text-muted text-sm">
                  Win rate: {Math.round((stats.won / stats.played) * 100)}%
                </div>
              )}
            </Card>
          </>
        )}
      </main>

      {targetPlayer && (
        <footer className="py-4 text-center space-y-1">
          {lastRefresh && (
            <p className="text-text-subtle text-xs">
              Data updated: {new Date(lastRefresh).toLocaleDateString("en-GB")}
            </p>
          )}
          {(status === "won" || status === "lost") && (
            <p className="text-text-subtle text-xs">
              Player ID: {targetPlayer.id}
            </p>
          )}
          {(status === "won" || status === "lost") && (
            <a
              href={`https://github.com/spiritsack/football-nerdle/issues/new?title=${encodeURIComponent(`Data error: ${targetPlayer.name}`)}&body=${encodeURIComponent(`**Player:** ${targetPlayer.name} (ID: ${targetPlayer.id})\n**Clubs shown:**\n${clubs.map((c) => `- ${c.teamName} ${c.yearJoined}${c.yearDeparted ? ` – ${c.yearDeparted}` : " – present"}`).join("\n")}\n\n**What's wrong:**\n`)}&labels=data-error`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-subtle hover:text-text-secondary text-xs underline"
            >
              Report data error
            </a>
          )}
        </footer>
      )}
    </PageLayout>
  );
}
