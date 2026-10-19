import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, Check, CircleX, History, RotateCcw, Share2, ShieldHalf, Trophy, X } from "lucide-react";
import { useGuessGame } from "./useGuessGame";
import { HARD_MODE_KEY } from "./constants";
import { mergeConsecutiveClubs, getTodayString, getDateForDay, getDayNumber, getAlreadyGuessedMap, formatWrongGuesses, shareResult } from "./helpers";
import AppShell from "../../components/AppShell";
import PlayerCard from "../../components/PlayerCard";
import DailyLeaderboard from "../../components/DailyLeaderboard";
import GuessDistribution from "./GuessDistribution";
import NextPuzzleCountdown from "./NextPuzzleCountdown";
import { getLastRefresh } from "../../api/playerCache";
import { ALERT_WARN, BTN_LG, BTN_PRIMARY, BTN_SECONDARY, PANEL, SECTION_LABEL } from "../../theme";

const DAY_NAV_BUTTON = `${BTN_SECONDARY} px-4 py-2 text-sm`;

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
    distribution,
    hints,
    announcement,
    startDaily,
    retry,
    loadArchiveDay,
    submitGuess,
    skipGuess,
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
  const [shareFeedback, setShareFeedback] = useState<"idle" | "copied" | "error">("idle");
  const shareFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);
  // Drop stale share feedback (e.g. an error) when a different puzzle loads
  const [shareFeedbackPlayer, setShareFeedbackPlayer] = useState(targetPlayer);
  if (shareFeedbackPlayer !== targetPlayer) {
    setShareFeedbackPlayer(targetPlayer);
    setShareFeedback("idle");
  }
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  useEffect(() => {
    getLastRefresh().then(setLastRefresh);
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (shareFeedbackTimer.current) clearTimeout(shareFeedbackTimer.current);
    };
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

  async function handleShare() {
    if (shareFeedbackTimer.current) {
      clearTimeout(shareFeedbackTimer.current);
      shareFeedbackTimer.current = null;
    }
    setShareFeedback("idle");
    const outcome = await shareResult(getShareText(hardMode), navigator);
    if (!isMounted.current) return;
    if (outcome === "failed") {
      // Stays visible until the next click so the player can copy the text by hand
      setShareFeedback("error");
      return;
    }
    // "shared" / "cancelled": the OS share sheet is its own feedback
    if (outcome !== "copied") return;
    if (shareFeedbackTimer.current) clearTimeout(shareFeedbackTimer.current);
    setShareFeedback("copied");
    shareFeedbackTimer.current = setTimeout(() => {
      shareFeedbackTimer.current = null;
      setShareFeedback("idle");
    }, 2000);
  }

  const mergedClubs = useMemo(() => mergeConsecutiveClubs(clubs), [clubs]);
  const alreadyGuessed = useMemo(() => getAlreadyGuessedMap(wrongGuesses), [wrongGuesses]);
  const resultScreen = (status === "won" || status === "lost") && targetPlayer;
  const wrongGuessesText = formatWrongGuesses(wrongGuesses);

  const todayDayNum = getDayNumber(today);

  const dayNavigation = (isDaily || isArchive) && dayNumber ? (
    <div className="flex items-center justify-center gap-3 text-sm">
      {dayNumber > 1 && (
        <button onClick={() => loadArchiveDay(dayNumber - 1)} className={DAY_NAV_BUTTON}>
          ‹ Previous day
        </button>
      )}
      {isArchive && (
        <button
          onClick={() => dayNumber < todayDayNum ? loadArchiveDay(dayNumber + 1) : navigate("/guess")}
          className={DAY_NAV_BUTTON}
        >
          Next day ›
        </button>
      )}
    </div>
  ) : null;

  const wrongGuessesRow = wrongGuessesText ? (
    <div
      data-testid="wrong-guesses"
      className="flex items-start gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-semibold px-4 py-3"
    >
      <CircleX className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" aria-hidden="true" />
      <span>{wrongGuessesText}</span>
    </div>
  ) : null;

  return (
    <AppShell>
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-testid="guess-announcer">
          {announcement}
        </div>

        <header className="glass-panel rounded-2xl border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 shrink-0 rounded-lg bg-pitch-500/10 border border-pitch-500/30 flex items-center justify-center text-pitch-400">
              <CalendarDays className="w-5 h-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-bold text-white text-base">
                {isArchive
                  ? dayNumber !== null ? `Archive — Daily #${dayNumber}` : "Archive"
                  : isDaily && dayNumber !== null ? `Guess the Player — Daily #${dayNumber}` : "Guess the Player"}
              </p>
              <div className="flex items-center gap-4 mt-0.5 text-xs">
                <Link to="/" className="text-pitch-400 hover:text-pitch-300 font-semibold">
                  ← Back to Home
                </Link>
                <Link to="/guess/archive" className="text-slate-400 hover:text-white font-semibold">
                  Archive
                </Link>
              </div>
            </div>
          </div>

          {status === "playing" && (
            <div className="flex items-center gap-3 bg-slate-900/60 py-1.5 px-3 rounded-xl border border-slate-800">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ShieldHalf className="w-3.5 h-3.5 text-gold-400" aria-hidden="true" />
                Show club names
              </span>
              <div className="relative group">
                <button
                  role="switch"
                  aria-checked={!hardMode}
                  aria-label="Show club names"
                  onClick={toggleHardMode}
                  disabled={!hardMode}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    !hardMode
                      ? "bg-pitch-500/60 cursor-not-allowed"
                      : "bg-slate-700 hover:bg-slate-600"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full transition-transform ${
                      !hardMode ? "translate-x-6 bg-slate-950" : "translate-x-1 bg-slate-300"
                    }`}
                  />
                </button>
                {!hardMode && (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute right-0 sm:left-1/2 sm:right-auto top-full z-10 mt-2 w-56 sm:-translate-x-1/2 rounded-lg bg-slate-800 px-3 py-2 text-center text-xs text-slate-200 shadow-lg border border-slate-700 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  >
                    You've peeked at today's teams — I'll reset this for tomorrow :)
                  </div>
                )}
              </div>
            </div>
          )}
        </header>

        {isArchive && (
          <div className="glass-card border-gold-500/40 bg-gold-500/10 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-gold-300 text-sm font-semibold flex items-center gap-2">
              <History className="w-4 h-4" aria-hidden="true" />
              {dayNumber !== null ? `This is an archived puzzle (Daily #${dayNumber})` : "This is an archived puzzle"}
            </p>
            <button onClick={handlePlayToday} className={`${BTN_PRIMARY} px-4 py-2 text-xs`}>
              Play Today's Daily
            </button>
          </div>
        )}

        {status === "loading" && (
          <p className="text-slate-400 text-center py-10">Loading player...</p>
        )}

        {status === "idle" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-10">
            {error && (
              <div role="alert" className={`${ALERT_WARN} max-w-md w-full`}>
                {error}
              </div>
            )}
            <button onClick={retry} className={`${BTN_PRIMARY} ${BTN_LG}`}>
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Try Again
            </button>
          </div>
        )}

        {status === "playing" && targetPlayer && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <p className="text-slate-300 font-semibold">Which player is this?</p>
              <div className="flex items-center gap-3">
                <div className="text-sm font-bold text-slate-400">
                  Attempts: <span className={`text-base font-extrabold ${attempts >= maxAttempts - 1 ? "text-rose-400" : "text-pitch-400"}`}>{attempts}</span>
                  <span className="text-slate-500"> / {maxAttempts}</span>
                </div>
                <div className="flex gap-1.5" aria-hidden="true">
                  {Array.from({ length: maxAttempts }, (_, i) => (
                    <span
                      key={i}
                      className={`w-3 h-3 rounded-full border ${
                        i < maxAttempts - attempts ? "bg-pitch-500 border-pitch-400" : "bg-slate-800 border-slate-700"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <PlayerCard
              player={targetPlayer}
              clubs={mergedClubs}
              hints={hints}
              revealed={false}
              hardMode={hardMode}
              onGuess={submitGuess}
              onSkip={skipGuess}
              attempts={attempts}
              maxAttempts={maxAttempts}
              disabledPlayerIds={alreadyGuessed}
            />

            {wrongGuessesRow}

            {error && (
              <div role="alert" className={ALERT_WARN}>
                {error}
              </div>
            )}

            {dayNavigation}
          </>
        )}

        {resultScreen && targetPlayer && (
          <>
            <section
              className={`glass-panel rounded-3xl p-5 sm:p-8 space-y-6 ${
                status === "won" ? "border-pitch-500/30 shadow-stadium" : "border-rose-500/30"
              }`}
            >
              <div className="text-center space-y-2">
                <span
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto border ${
                    status === "won"
                      ? "bg-pitch-500/20 text-pitch-400 border-pitch-500/40"
                      : "bg-rose-500/20 text-rose-400 border-rose-500/40"
                  }`}
                >
                  {status === "won"
                    ? <Trophy className="w-8 h-8" aria-hidden="true" />
                    : <X className="w-8 h-8" aria-hidden="true" />}
                </span>
                <h2 className={`text-3xl font-extrabold ${status === "won" ? "text-pitch-400" : "text-rose-400"}`}>
                  {status === "won" ? "Correct!" : "Game Over!"}
                </h2>
                <p className="text-slate-300 text-sm">
                  {status === "won" ? (
                    <>Guessed in <span className="text-pitch-400 font-bold">{attempts}</span> {attempts === 1 ? "attempt" : "attempts"}</>
                  ) : (
                    <span className="text-rose-400">Not guessed</span>
                  )}
                </p>
              </div>

              <PlayerCard
                player={targetPlayer}
                clubs={mergedClubs}
                hints={hints}
                revealed={true}
                hardMode={false}
                result={status === "won" ? "won" : "lost"}
              />

              {wrongGuessesRow}

              <div className="flex gap-3 flex-wrap justify-center">
                <button onClick={handleShare} className={`${BTN_PRIMARY} ${BTN_LG} flex-1 min-w-48`}>
                  {shareFeedback === "copied"
                    ? <Check className="w-4 h-4" aria-hidden="true" />
                    : <Share2 className="w-4 h-4" aria-hidden="true" />}
                  {shareFeedback === "copied" ? "Copied!" : "Share Result"}
                </button>
                {!isDaily && (
                  <button onClick={handlePlayToday} className={`${BTN_SECONDARY} ${BTN_LG} flex-1 min-w-48`}>
                    Play Today's Daily
                  </button>
                )}
              </div>

              {shareFeedback === "error" && (
                <div role="alert" className={ALERT_WARN}>
                  <p>Couldn't share or copy your result. Try again or copy it manually.</p>
                  <pre className="mt-2 select-all whitespace-pre-wrap break-words text-left text-slate-300 font-mono text-xs">
                    {getShareText(hardMode)}
                  </pre>
                </div>
              )}

              {isDaily && !isArchive && <NextPuzzleCountdown key={today} today={today} />}

              {dayNavigation}
            </section>

            {(isDaily || isArchive) && (
              <div className="grid md:grid-cols-2 gap-6 items-start">
                <div data-testid="guess-stats" className={`${PANEL} p-5 sm:p-6`}>
                  <h3 className={`${SECTION_LABEL} text-center mb-4`}>Your Stats</h3>
                  <div className="grid grid-cols-5 gap-1.5 sm:gap-2 text-center">
                    {[
                      { label: "Played", value: stats.played, color: "text-white" },
                      { label: "Won", value: stats.won, color: "text-pitch-400" },
                      { label: "Lost", value: stats.lost, color: "text-rose-400" },
                      { label: "Streak", value: stats.streak, color: "text-gold-400" },
                      { label: "Best", value: stats.longestStreak, color: "text-gold-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="glass-card rounded-xl py-2.5 px-1">
                        <div className={`text-xl sm:text-2xl font-extrabold ${color}`}>{value}</div>
                        <div className="text-slate-400 text-[10px] sm:text-xs font-semibold">{label}</div>
                      </div>
                    ))}
                  </div>
                  {stats.played > 0 && (
                    <div className="mt-3 text-center text-slate-400 text-sm">
                      Win rate: {Math.round((stats.won / stats.played) * 100)}%
                    </div>
                  )}
                  <GuessDistribution
                    distribution={distribution}
                    highlight={isDaily && status === "won" ? attempts : undefined}
                  />
                </div>

                <DailyLeaderboard
                  date={isArchive && dayNumber ? getDateForDay(dayNumber) : today}
                  userAttempts={status === "won" ? attempts : 0}
                />
              </div>
            )}
          </>
        )}
      </main>

      {targetPlayer && (
        <footer className="py-6 text-center space-y-1">
          {lastRefresh && (
            <p className="text-slate-600 text-xs">
              Data updated: {new Date(lastRefresh).toLocaleDateString("en-GB")}
            </p>
          )}
          {(status === "won" || status === "lost") && (
            <p className="text-slate-600 text-xs">
              Player ID: {targetPlayer.id}
            </p>
          )}
          {(status === "won" || status === "lost") && (
            <a
              href={`https://github.com/spiritsack/football-nerdle/issues/new?title=${encodeURIComponent(`Data error: ${targetPlayer.name}`)}&body=${encodeURIComponent(`**Player:** ${targetPlayer.name} (ID: ${targetPlayer.id})\n**Clubs shown:**\n${clubs.map((c) => `- ${c.teamName} ${c.yearJoined}${c.yearDeparted ? ` – ${c.yearDeparted}` : " – present"}`).join("\n")}\n\n**What's wrong:**\n`)}&labels=data-error`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-slate-300 text-xs underline"
            >
              Report data error
            </a>
          )}
        </footer>
      )}
    </AppShell>
  );
}
