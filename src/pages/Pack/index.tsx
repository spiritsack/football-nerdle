import { useState } from "react";
import { Link } from "react-router-dom";
import { usePackGame } from "./usePackGame";
import PlayerSearch from "../../components/PlayerSearch";
import { MAX_GUESSES_PER_PLAYER } from "./constants";
import { deriveHints } from "./hints";
import { buildShareText, getPackDayNumber } from "./helpers";

export default function Pack() {
  const { state, submitGuess } = usePackGame();
  const { pack, status, currentIndex, guessesForCurrent, wrongGuessesForCurrent, score, attempts, error } = state;
  const currentPlayer = pack?.players[currentIndex] ?? null;
  const lastAttempt = attempts[attempts.length - 1];
  const hints = currentPlayer && pack
    ? deriveHints(currentPlayer, pack.club.id, wrongGuessesForCurrent.length)
    : null;
  const [copied, setCopied] = useState(false);

  function handleShare() {
    if (!pack) return;
    const text = buildShareText({
      date: pack.date,
      clubName: pack.club.name,
      score,
      attempts,
    });
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="py-6 border-b border-gray-700">
        <h1 className="text-3xl font-bold text-center">Football Nerdle</h1>
        <p className="text-gray-400 text-center mt-1">
          Pack Mode {pack ? `— ${pack.club.name}` : ""}
        </p>
        <div className="flex items-center justify-center gap-4 mt-2">
          <Link to="/" className="text-green-400 hover:text-green-300 text-sm">← Back to Home</Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-6">
        {status === "loading" && <p className="text-gray-400">Loading pack...</p>}

        {status === "idle" && (
          <div role="alert" className="bg-orange-900/30 border border-orange-700 rounded-lg px-4 py-3 max-w-md w-full text-center text-orange-300 text-sm">
            {error ?? "No pack available."}
          </div>
        )}

        {pack && (status === "playing" || status === "revealing") && currentPlayer && (
          <>
            {pack.club.badge && (
              <img src={pack.club.badge} alt={pack.club.name} className="w-16 h-16 object-contain" />
            )}

            <ProgressStrip total={pack.players.length} attempts={attempts} currentIndex={currentIndex} />

            <div className="text-lg">
              Player <span className="font-bold text-green-400">{currentIndex + 1}</span>
              <span className="text-gray-500"> / {pack.players.length}</span>
              <span className="text-gray-500 ml-4">Score: <span className="text-green-400 font-bold">{score}</span></span>
            </div>

            <div className="text-sm text-gray-400">
              Guesses: <span className={`font-bold ${guessesForCurrent >= MAX_GUESSES_PER_PLAYER - 1 ? "text-red-400" : "text-green-400"}`}>{guessesForCurrent}</span>
              <span className="text-gray-500"> / {MAX_GUESSES_PER_PLAYER}</span>
            </div>

            <div className="bg-gray-800 border border-gray-600 rounded-xl p-4 max-w-sm w-full">
              <img
                src={currentPlayer.thumbnail}
                alt={status === "revealing" ? currentPlayer.name : "Mystery player"}
                className="w-full aspect-square object-cover rounded-lg bg-gray-700"
              />
              {status === "revealing" && (
                <div className="mt-3 text-center">
                  <p className={`text-xl font-bold ${lastAttempt?.correct ? "text-green-400" : "text-red-400"}`}>
                    {currentPlayer.name}
                  </p>
                  <p className="text-gray-400 text-sm">{lastAttempt?.correct ? "Correct!" : "Out of guesses"}</p>
                </div>
              )}
            </div>

            {hints && <HintsList hints={hints} />}

            {status === "playing" && (
              <PlayerSearch onSelect={submitGuess} placeholder="Player name" hideThumbnails />
            )}

            {wrongGuessesForCurrent.length > 0 && (
              <div className="text-sm text-gray-400">
                Wrong: {wrongGuessesForCurrent.map((p) => p.name).join(", ")}
              </div>
            )}
          </>
        )}

        {status === "finished" && pack && (
          <>
            <p className="text-gray-300 text-lg">
              {pack.club.name} · Pack #{getPackDayNumber(pack.date)}
            </p>
            <p className="text-7xl font-bold bg-gradient-to-br from-green-300 to-emerald-500 bg-clip-text text-transparent">
              {score}<span className="text-gray-500">/{pack.players.length}</span>
            </p>
            <p className="text-2xl tracking-wide" aria-label="Result grid">
              {attempts.map((a) => (a.correct ? "✅" : "❌")).join("")}
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={handleShare}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors"
              >
                {copied ? "Copied!" : "Share Result"}
              </button>
              <Link to="/" className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition-colors">
                Back to Home
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function HintsList({ hints }: { hints: ReturnType<typeof deriveHints> }) {
  const items: { label: string; value: string }[] = [];
  if (hints.nationality) items.push({ label: "Nationality", value: hints.nationality });
  if (hints.position) items.push({ label: "Position", value: hints.position });
  if (hints.era) items.push({ label: "Era at this club", value: hints.era });
  if (hints.otherClub) items.push({ label: "Also played for", value: hints.otherClub });
  if (items.length === 0) return null;
  return (
    <dl aria-label="Hints" className="grid grid-cols-2 gap-x-4 gap-y-1 max-w-sm w-full text-sm">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-gray-400 text-right">{item.label}</dt>
          <dd className="text-white font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProgressStrip({
  total,
  attempts,
  currentIndex,
}: {
  total: number;
  attempts: { correct: boolean }[];
  currentIndex: number;
}) {
  return (
    <div role="list" aria-label="Pack progress" className="flex gap-1.5">
      {Array.from({ length: total }, (_, i) => {
        const a = attempts[i];
        const cls =
          a?.correct ? "bg-green-500" :
          a && !a.correct ? "bg-red-500" :
          i === currentIndex ? "bg-yellow-500" :
          "bg-gray-700";
        return <span key={i} role="listitem" className={`w-3 h-3 rounded-full ${cls}`} />;
      })}
    </div>
  );
}
