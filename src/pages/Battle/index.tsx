import { useNavigate } from "react-router-dom";
import { useGame } from "./useGame";
import PlayerSearch from "../../components/PlayerSearch";
import PageLayout from "../../components/PageLayout";
import PageHeader from "../../components/PageHeader";
import Button from "../../components/Button";
import Card from "../../components/Card";
import Alert from "../../components/Alert";

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
    <PageLayout>
      <PageHeader
        subtitle="Battle Mode"
        links={[{ to: "/", label: "← Back to Home" }]}
      />

      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-6">
        {/* Mode selection */}
        {status === "idle" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 max-w-sm w-full">
            <p className="text-text-secondary text-lg text-center">
              Name footballers who played together to build the longest chain.
              15 seconds per turn.
            </p>
            {bestStreak > 0 && (
              <p className="text-text-muted">
                Best streak: <span className="text-warning font-bold">{bestStreak}</span>
              </p>
            )}
            <Button onClick={startGame} size="lg" className="w-full">
              Practice
            </Button>
            <Button onClick={() => navigate("/battle/multiplayer")} variant="secondary" size="lg" className="w-full">
              Play with a Friend
            </Button>
          </div>
        )}

        {status === "loading" && (
          <p className="text-text-muted">Starting game...</p>
        )}

        {/* In-game UI */}
        {(status === "playing" || status === "checking") && (
          <>
            {/* Score & Timer */}
            <div className="flex gap-6 text-lg items-center">
              <div>
                Chain: <span className="text-success font-bold">{score}</span>
              </div>
              <div>
                Best: <span className="text-warning font-bold">{bestStreak}</span>
              </div>
              <div
                className={`font-mono font-bold text-2xl ${timeLeft <= 5 ? "text-error" : "text-white"}`}
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
                      {i > 0 && <span className="text-text-subtle">→</span>}
                      <div className="bg-surface-card rounded-lg px-3 py-2 text-sm text-center">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-text-muted text-xs">{p.nationality}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Current player card */}
            {currentPlayer && (
              <Card className="text-center max-w-sm w-full">
                {currentPlayer.thumbnail && (
                  <img
                    src={currentPlayer.thumbnail}
                    alt={currentPlayer.name}
                    className="w-24 h-24 rounded-full mx-auto mb-4 object-cover bg-surface-input"
                  />
                )}
                <h2 className="text-2xl font-bold">{currentPlayer.name}</h2>
                <p className="text-text-muted">{currentPlayer.nationality}</p>
                {lastSharedClubs.length > 0 && (
                  <p className="text-success text-sm mt-2">
                    Linked via: {lastSharedClubs.join(", ")}
                  </p>
                )}
              </Card>
            )}

            {/* Error */}
            {error && (
              <Alert className="max-w-md w-full">{error}</Alert>
            )}

            {/* Prompt */}
            {status === "playing" && (
              <p className="text-text-secondary">
                Name a player who played with <span className="text-success font-semibold">{currentPlayer?.name}</span>
              </p>
            )}

            <PlayerSearch
              onSelect={submitPlayer}
              disabled={status === "checking"}
              usedPlayerIds={usedPlayerIds}
            />

            {status === "checking" && (
              <p className="text-warning">Checking...</p>
            )}
          </>
        )}

        {/* Game Over */}
        {status === "gameover" && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-error mb-2">Game Over!</h2>
            {error && !timedOut && !wrongResult ? (
              <p className="text-orange-300 mb-4">{error}</p>
            ) : timedOut ? (
              <p className="text-text-secondary mb-4">Time's up!</p>
            ) : wrongResult ? (
              <>
                <p className="text-text-secondary mb-4">
                  <span className="text-white font-semibold">{wrongResult.player.name}</span> didn't play with{" "}
                  <span className="text-white font-semibold">{currentPlayer?.name}</span>
                </p>
                <div className="text-sm text-text-muted mb-4 text-left">
                  <p className="mb-1 font-medium text-text-secondary">{currentPlayer?.name}'s clubs:</p>
                  <p className="mb-3">{wrongResult.checkedClubs.a.join(", ") || "None found"}</p>
                  <p className="mb-1 font-medium text-text-secondary">{wrongResult.player.name}'s clubs:</p>
                  <p>{wrongResult.checkedClubs.b.join(", ") || "None found"}</p>
                </div>
              </>
            ) : null}
            <p className="text-lg mb-2">
              Final score: <span className="text-success font-bold">{score}</span>
            </p>
            {score >= bestStreak && score > 0 && (
              <p className="text-warning text-sm mb-2">New best streak!</p>
            )}
            <p className="text-sm text-text-muted mb-4">
              Best: <span className="text-warning font-bold">{bestStreak}</span>
            </p>
            <Button onClick={startGame}>Play Again</Button>
          </div>
        )}
      </main>
    </PageLayout>
  );
}
