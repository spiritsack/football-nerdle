import { useState, useEffect } from "react";
import { useMultiplayerRoom } from "./useMultiplayerRoom";
import MultiplayerGame from "./MultiplayerGame";
import PageLayout from "../../components/PageLayout";
import PageHeader from "../../components/PageHeader";
import Button from "../../components/Button";
import Card from "../../components/Card";
import Alert from "../../components/Alert";

export default function MultiplayerBattle() {
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

  const [lobbyCleanedUp, setLobbyCleanedUp] = useState(false);
  useEffect(() => {
    if (status === "ready" && !lobbyCleanedUp) {
      cleanup();
      setLobbyCleanedUp(true);
    }
  }, [status, lobbyCleanedUp, cleanup]);

  if (status === "ready" && lobbyCleanedUp && room && playerId) {
    return (
      <MultiplayerGame room={room} playerId={playerId} isHost={isHost} />
    );
  }

  return (
    <PageLayout>
      <PageHeader
        subtitle="Multiplayer Battle"
        links={[{ to: "/", label: "← Back to Home" }]}
      />

      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-6">
        {(status === "idle" || status === "error") && (
          <div className="flex flex-col items-center gap-8 max-w-sm w-full">
            <div className="text-center">
              <p className="text-text-secondary text-lg mb-6">
                Play against a friend! Create a room or join with a code.
              </p>
            </div>

            <Button onClick={createRoom} size="lg" className="w-full">
              Create Room
            </Button>

            <div className="w-full flex items-center gap-3">
              <div className="flex-1 h-px bg-border-subtle" />
              <span className="text-text-subtle text-sm">OR</span>
              <div className="flex-1 h-px bg-border-subtle" />
            </div>

            <div className="w-full flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter code"
                maxLength={6}
                className="flex-1 px-4 py-3 bg-surface-card border border-border-default rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-border-accent text-center text-xl tracking-widest font-mono"
              />
              <Button
                onClick={() => joinRoom(joinCode)}
                disabled={joinCode.length < 6}
                variant="secondary"
                className="disabled:bg-surface-input disabled:text-text-subtle"
              >
                Join
              </Button>
            </div>

            {error && (
              <Alert className="w-full">{error}</Alert>
            )}
          </div>
        )}

        {status === "creating" && (
          <p className="text-text-muted">Creating room...</p>
        )}

        {status === "joining" && (
          <p className="text-text-muted">Joining room...</p>
        )}

        {status === "reconnecting" && (
          <p className="text-text-muted">Reconnecting to game...</p>
        )}

        {status === "waiting" && room && (
          <div className="flex flex-col items-center gap-6 max-w-sm w-full">
            <p className="text-text-secondary text-lg">
              Waiting for opponent to join...
            </p>

            <Card className="text-center w-full">
              <p className="text-text-muted text-sm mb-2">Room Code</p>
              <p className="text-4xl font-mono font-bold tracking-widest text-success">
                {room.code}
              </p>
            </Card>

            <Button onClick={handleCopyCode} variant="secondary">
              {copied ? "Copied!" : "Copy Invite Link"}
            </Button>

            <div className="flex items-center gap-2 text-text-subtle">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm">Listening for opponent...</span>
            </div>
          </div>
        )}
      </main>
    </PageLayout>
  );
}
