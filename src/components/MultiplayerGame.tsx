import { Link } from "react-router-dom";
import { useMultiplayerGame } from "../hooks/useMultiplayerGame";
import PlayerSearch from "./PlayerSearch";
import type { GameRoom } from "../types";

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
    timeLeft,
    startGame,
    submitPlayer,
  } = useMultiplayerGame(initialRoom, playerId, isHost);

  const chain = room.chain;
  const isFinished = status === "finished";
  const iWon = room.winner === playerId;
  const usedPlayerIds = new Set(room.used_player_ids);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="py-6 border-b border-gray-700">
        <h1 className="text-3xl font-bold text-center">Football Nerdle</h1>
        <p className="text-gray-400 text-center mt-1">
          Multiplayer Battle — Room {room.code}
        </p>
        <div className="text-center mt-2">
          <Link to="/" className="text-green-400 hover:text-green-300 text-sm">
            &larr; Back to Home
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-6">
        {/* Pre-game: host starts */}
        {status === "starting" && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-gray-300 text-lg">Both players connected!</p>
            {isHost ? (
              <button
                onClick={startGame}
                className="px-8 py-4 bg-green-600 hover:bg-green-500 rounded-lg text-xl font-semibold transition-colors"
              >
                Start Game
              </button>
            ) : (
              <p className="text-gray-400">Waiting for host to start...</p>
            )}
          </div>
        )}

        {/* In-game */}
        {(status === "playing" || status === "checking") && (
          <>
            {/* Turn indicator & timer */}
            <div className="flex gap-6 text-lg items-center">
              <div>
                Chain: <span className="text-green-400 font-bold">{room.score}</span>
              </div>
              <div className={`font-mono font-bold text-2xl ${timeLeft <= 5 ? "text-red-400" : "text-white"}`}>
                {timeLeft}s
              </div>
            </div>

            <div className={`px-4 py-2 rounded-full text-sm font-medium ${
              isMyTurn
                ? "bg-green-600/30 border border-green-500 text-green-300"
                : "bg-gray-700 text-gray-400"
            }`}>
              {isMyTurn ? "Your turn!" : "Opponent's turn..."}
            </div>

            {/* Chain display */}
            {chain.length > 1 && (
              <div className="w-full max-w-2xl overflow-x-auto">
                <div className="flex gap-2 items-center pb-2">
                  {chain.map((p, i) => (
                    <div key={`${p.id}-${i}`} className="flex items-center gap-2 shrink-0">
                      {i > 0 && <span className="text-gray-500">&rarr;</span>}
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
                {room.last_shared_clubs.length > 0 && (
                  <p className="text-green-400 text-sm mt-2">
                    Linked via: {room.last_shared_clubs.join(", ")}
                  </p>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-orange-900/30 border border-orange-700 rounded-lg px-4 py-3 max-w-md w-full text-center text-orange-300 text-sm">
                {error}
              </div>
            )}

            {/* Search (only when it's my turn) */}
            {isMyTurn && status === "playing" && (
              <>
                <p className="text-gray-300">
                  Name a player who played with{" "}
                  <span className="text-green-400 font-semibold">
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
              <p className="text-yellow-400">Checking...</p>
            )}
          </>
        )}

        {/* Game Over */}
        {isFinished && (
          <div className={`${iWon ? "bg-green-900/30 border-green-700" : "bg-red-900/30 border-red-700"} border rounded-xl p-6 max-w-md w-full text-center`}>
            <h2 className={`text-2xl font-bold mb-2 ${iWon ? "text-green-400" : "text-red-400"}`}>
              {iWon ? "You Win!" : "You Lose!"}
            </h2>

            {room.lose_reason === "timeout" && (
              <p className="text-gray-300 mb-4">
                {iWon ? "Your opponent ran out of time!" : "Time's up!"}
              </p>
            )}

            {room.lose_reason === "wrong" && wrongResult && (
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
            )}

            {room.lose_reason === "disconnect" && (
              <p className="text-gray-300 mb-4">
                {iWon ? "Your opponent disconnected." : "You disconnected."}
              </p>
            )}

            <p className="text-lg mb-4">
              Chain length: <span className="text-green-400 font-bold">{room.score}</span>
            </p>

            <Link
              to="/battle/multiplayer"
              className="inline-block px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition-colors"
              onClick={() => window.location.reload()}
            >
              Play Again
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
