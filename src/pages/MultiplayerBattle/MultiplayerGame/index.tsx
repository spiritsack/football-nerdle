import { Link } from "react-router-dom";
import { useMultiplayerGame } from "../useMultiplayerGame";
import { SESSION_KEY } from "../constants";
import PlayerSearch from "../../../components/PlayerSearch";
import PageLayout from "../../../components/PageLayout";
import PageHeader from "../../../components/PageHeader";
import Button from "../../../components/Button";
import Card from "../../../components/Card";
import Alert from "../../../components/Alert";
import type { GameRoom } from "../../../types";

interface Props {
  room: GameRoom;
  playerId: string;
  isHost: boolean;
}

export default function MultiplayerGame({ room: initialRoom, playerId, isHost }: Props) {
  const {
    room,
    status,
    error,
    wrongResult,
    currentPlayer,
    isMyTurn,
    opponentConnected,
    timeLeft,
    startGame,
    submitPlayer,
  } = useMultiplayerGame(initialRoom, playerId, isHost);

  const chain = room.chain;
  const isFinished = status === "finished";
  const iWon = room.winner === playerId;
  const usedPlayerIds = new Set(room.used_player_ids);

  return (
    <PageLayout>
      <PageHeader
        subtitle={`Multiplayer Battle — Room ${room.code}`}
        links={[{ to: "/", label: "← Back to Home" }]}
      />

      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-6">
        {status === "starting" && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-text-secondary text-lg">Both players connected!</p>
            {isHost ? (
              <>
                {error && (
                  <Alert className="max-w-md w-full">{error}</Alert>
                )}
                <Button onClick={startGame} size="lg">
                  Start Game
                </Button>
              </>
            ) : (
              <p className="text-text-muted">Waiting for host to start...</p>
            )}
          </div>
        )}

        {(status === "playing" || status === "checking") && (
          <>
            <div className="flex gap-6 text-lg items-center">
              <div>
                Chain: <span className="text-success font-bold">{room.score}</span>
              </div>
              <div
                className={`font-mono font-bold text-2xl ${timeLeft <= 5 ? "text-error" : "text-white"}`}
                aria-label={`${timeLeft} seconds remaining`}
                aria-live={timeLeft <= 5 ? "assertive" : "off"}
              >
                {timeLeft}s
              </div>
            </div>

            <div className={`px-4 py-2 rounded-full text-sm font-medium ${
              isMyTurn
                ? "bg-green-600/30 border border-green-500 text-green-300"
                : "bg-surface-input text-text-muted"
            }`}>
              {isMyTurn ? "Your turn!" : "Opponent's turn..."}
            </div>

            {!opponentConnected && (
              <Alert variant="info" className="max-w-md w-full">
                Opponent disconnected — game paused, waiting up to 1 minute to reconnect...
              </Alert>
            )}

            {chain.length > 1 && (
              <div className="w-full max-w-2xl overflow-x-auto">
                <div className="flex gap-2 items-center pb-2">
                  {chain.map((p, i) => (
                    <div key={`${p.id}-${i}`} className="flex items-center gap-2 shrink-0">
                      {i > 0 && <span className="text-text-subtle">&rarr;</span>}
                      <div className="bg-surface-card rounded-lg px-3 py-2 text-sm text-center">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-text-muted text-xs">{p.nationality}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                {room.last_shared_clubs.length > 0 && (
                  <p className="text-success text-sm mt-2">
                    Linked via: {room.last_shared_clubs.join(", ")}
                  </p>
                )}
              </Card>
            )}

            {error && (
              <Alert className="max-w-md w-full">{error}</Alert>
            )}

            {isMyTurn && status === "playing" && (
              <>
                <p className="text-text-secondary">
                  Name a player who played with{" "}
                  <span className="text-success font-semibold">
                    {currentPlayer?.name}
                  </span>
                </p>
                <PlayerSearch
                  onSelect={submitPlayer}
                  disabled={status !== "playing"}
                  usedPlayerIds={usedPlayerIds}
                />
              </>
            )}

            {status === "checking" && (
              <p className="text-warning">Checking...</p>
            )}
          </>
        )}

        {isFinished && (
          <div className={`${iWon ? "bg-green-900/30 border-green-700" : "bg-red-900/30 border-red-700"} border rounded-xl p-6 max-w-md w-full text-center`}>
            <h2 className={`text-2xl font-bold mb-2 ${iWon ? "text-success" : "text-error"}`}>
              {iWon ? "You Win!" : "You Lose!"}
            </h2>

            {room.lose_reason === "timeout" && (
              <p className="text-text-secondary mb-4">
                {iWon ? "Your opponent ran out of time!" : "Time's up!"}
              </p>
            )}

            {room.lose_reason === "wrong" && wrongResult && (
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
            )}

            {room.lose_reason === "wrong" && !wrongResult && (
              <p className="text-text-secondary mb-4">
                Your opponent picked the wrong player!
              </p>
            )}

            {room.lose_reason === "disconnect" && (
              <p className="text-text-secondary mb-4">
                {iWon ? "Your opponent disconnected." : "You disconnected."}
              </p>
            )}

            <p className="text-lg mb-2">
              Chain length: <span className="text-success font-bold">{room.score}</span>
            </p>

            {chain.length > 1 && (
              <div className="w-full max-w-md overflow-x-auto mb-4">
                <div className="flex gap-1 items-center pb-2 justify-center flex-wrap">
                  {chain.map((p, i) => (
                    <div key={`${p.id}-${i}`} className="flex items-center gap-1 shrink-0">
                      {i > 0 && <span className="text-text-subtle text-xs">&rarr;</span>}
                      <span className="bg-surface-card rounded px-2 py-1 text-xs">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              {isHost ? (
                <Button onClick={startGame}>Rematch</Button>
              ) : (
                <p className="text-text-muted text-sm">Waiting for host to rematch...</p>
              )}
              <Link
                to="/battle/multiplayer"
                className="px-6 py-3 bg-surface-input hover:bg-gray-600 rounded-lg font-semibold transition-colors"
                onClick={() => {
                  localStorage.removeItem(SESSION_KEY);
                  window.location.reload();
                }}
              >
                New Room
              </Link>
            </div>
          </div>
        )}
      </main>
    </PageLayout>
  );
}
