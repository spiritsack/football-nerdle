import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useMultiplayerRoom } from "../hooks/useMultiplayerRoom";
import MultiplayerGame from "./MultiplayerGame";

export default function MultiplayerLobby() {
  const { status, room, playerId, isHost, error, createRoom, joinRoom, cleanup } =
    useMultiplayerRoom();
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);

  function handleCopyCode() {
    if (!room) return;
    const url = `${window.location.origin}${window.location.pathname}#/battle/multiplayer?code=${room.code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Clean up lobby channel before game mounts (so game can create its own with presence)
  const [lobbyCleanedUp, setLobbyCleanedUp] = useState(false);
  useEffect(() => {
    if (status === "ready" && !lobbyCleanedUp) {
      cleanup();
      setLobbyCleanedUp(true);
    }
  }, [status, lobbyCleanedUp, cleanup]);

  // Once both players are ready AND lobby channel is cleaned up, show the game
  if (status === "ready" && lobbyCleanedUp && room && playerId) {
    return (
      <MultiplayerGame room={room} playerId={playerId} isHost={isHost} />
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="py-6 border-b border-gray-700">
        <h1 className="text-3xl font-bold text-center">Football Nerdle</h1>
        <p className="text-gray-400 text-center mt-1">Multiplayer Battle</p>
        <div className="text-center mt-2">
          <Link
            to="/"
            className="text-green-400 hover:text-green-300 text-sm"
          >
            &larr; Back to Home
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-6">
        {/* Idle — show create/join options */}
        {(status === "idle" || status === "error") && (
          <div className="flex flex-col items-center gap-8 max-w-sm w-full">
            <div className="text-center">
              <p className="text-gray-300 text-lg mb-6">
                Play against a friend! Create a room or join with a code.
              </p>
            </div>

            <button
              onClick={createRoom}
              className="w-full px-6 py-4 bg-green-600 hover:bg-green-500 rounded-lg text-xl font-semibold transition-colors"
            >
              Create Room
            </button>

            <div className="w-full flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-700" />
              <span className="text-gray-500 text-sm">OR</span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

            <div className="w-full flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter code"
                maxLength={6}
                className="flex-1 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500 text-center text-xl tracking-widest font-mono"
              />
              <button
                onClick={() => joinRoom(joinCode)}
                disabled={joinCode.length < 6}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-semibold transition-colors"
              >
                Join
              </button>
            </div>

            {error && (
              <div className="bg-orange-900/30 border border-orange-700 rounded-lg px-4 py-3 w-full text-center text-orange-300 text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Creating */}
        {status === "creating" && (
          <p className="text-gray-400">Creating room...</p>
        )}

        {/* Joining */}
        {status === "joining" && (
          <p className="text-gray-400">Joining room...</p>
        )}

        {/* Reconnecting */}
        {status === "reconnecting" && (
          <p className="text-gray-400">Reconnecting to game...</p>
        )}

        {/* Waiting for opponent */}
        {status === "waiting" && room && (
          <div className="flex flex-col items-center gap-6 max-w-sm w-full">
            <p className="text-gray-300 text-lg">
              Waiting for opponent to join...
            </p>

            <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 text-center w-full">
              <p className="text-gray-400 text-sm mb-2">Room Code</p>
              <p className="text-4xl font-mono font-bold tracking-widest text-green-400">
                {room.code}
              </p>
            </div>

            <button
              onClick={handleCopyCode}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors"
            >
              {copied ? "Copied!" : "Copy Invite Link"}
            </button>

            <div className="flex items-center gap-2 text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm">Listening for opponent...</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
