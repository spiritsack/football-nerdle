import { useEffect, useMemo, useState } from "react";
import PlayerSearch from "../../components/PlayerSearch";
import { searchClubs } from "../../api/adminApi";
import { isPackScheduled, publishPack } from "../../api/packAdminApi";
import { validatePackForPublish, type PackBuilderState } from "./packBuilderValidation";
import type { Player } from "../../types";

const PACK_SIZE = 10;
const EMPTY_SLOTS: (Player | null)[] = Array(PACK_SIZE).fill(null);

interface ClubOption {
  id: string;
  name: string;
  badge: string;
}

function getDefaultDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function PackBuilder() {
  const [club, setClub] = useState<ClubOption | null>(null);
  const [clubQuery, setClubQuery] = useState("");
  const [clubResults, setClubResults] = useState<ClubOption[]>([]);
  const [players, setPlayers] = useState<(Player | null)[]>(EMPTY_SLOTS);
  const [date, setDate] = useState<string>(getDefaultDate);
  const [alreadyScheduled, setAlreadyScheduled] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // Search clubs
  useEffect(() => {
    if (clubQuery.trim().length < 2) {
      setClubResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const results = await searchClubs(clubQuery.trim());
      setClubResults(results);
    }, 250);
    return () => clearTimeout(handle);
  }, [clubQuery]);

  // Check date conflict
  useEffect(() => {
    let cancelled = false;
    if (!date) {
      setAlreadyScheduled(false);
      return;
    }
    isPackScheduled(date).then((scheduled) => {
      if (!cancelled) setAlreadyScheduled(scheduled);
    });
    return () => { cancelled = true; };
  }, [date]);

  const state: PackBuilderState = useMemo(
    () => ({ clubId: club?.id ?? null, players, date, alreadyScheduled }),
    [club, players, date, alreadyScheduled],
  );

  const validation = validatePackForPublish(state);

  const usedPlayerIds = useMemo(
    () => new Set(players.filter((p): p is Player => p !== null).map((p) => p.id)),
    [players],
  );

  function setPlayerAt(index: number, player: Player | null) {
    setPlayers((prev) => {
      const next = [...prev];
      next[index] = player;
      return next;
    });
  }

  async function handlePublish() {
    if (!validation.ok || !club) return;
    setPublishing(true);
    setPublishMessage(null);
    const ids = players.map((p) => p!.id);
    const result = await publishPack(date, club.id, ids);
    setPublishing(false);
    if (result.ok) {
      setPublishMessage({ kind: "ok", text: `Pack published for ${date}` });
      setPlayers(EMPTY_SLOTS);
      setAlreadyScheduled(true);
    } else {
      setPublishMessage({ kind: "error", text: result.error ?? "Publish failed" });
    }
  }

  return (
    <section aria-label="Pack Builder" className="bg-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-semibold mb-4">Pack Builder</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-gray-400">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500"
          />
          {alreadyScheduled && (
            <span className="text-xs text-amber-400">A pack is already scheduled for this date.</span>
          )}
        </label>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-gray-400" htmlFor="club-search">Club</label>
          {club ? (
            <div className="flex items-center gap-2 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2">
              {club.badge && <img src={club.badge} alt="" className="w-6 h-6 object-contain" />}
              <span className="flex-1 text-white">{club.name}</span>
              <button
                type="button"
                onClick={() => { setClub(null); setClubQuery(""); }}
                className="text-gray-400 hover:text-white text-sm"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                id="club-search"
                type="text"
                value={clubQuery}
                onChange={(e) => setClubQuery(e.target.value)}
                placeholder="Search clubs..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
              />
              {clubResults.length > 0 && (
                <ul role="listbox" className="absolute z-10 mt-1 w-full bg-gray-700 border border-gray-600 rounded-lg max-h-64 overflow-y-auto shadow-lg">
                  {clubResults.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => { setClub(c); setClubQuery(""); setClubResults([]); }}
                        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-600 text-left"
                      >
                        {c.badge && <img src={c.badge} alt="" className="w-6 h-6 object-contain" />}
                        <span className="text-white">{c.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-6">
        <h3 className="text-sm text-gray-400">Players ({players.filter(Boolean).length} / {PACK_SIZE})</h3>
        {players.map((player, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-6 text-gray-500 text-sm shrink-0">{i + 1}.</span>
            {player ? (
              <div className="flex-1 flex items-center gap-2 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2">
                {player.thumbnail
                  ? <img src={player.thumbnail} alt="" className="w-8 h-8 rounded-full object-cover bg-gray-600" />
                  : <span className="w-8 h-8 rounded-full bg-red-900/50 flex items-center justify-center text-red-300 text-xs">!</span>
                }
                <span className="flex-1 text-white">{player.name}</span>
                {!player.thumbnail && <span className="text-xs text-red-400">no photo</span>}
                <button
                  type="button"
                  onClick={() => setPlayerAt(i, null)}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex-1">
                <PlayerSearch
                  onSelect={(p) => setPlayerAt(i, p)}
                  usedPlayerIds={usedPlayerIds}
                  placeholder={`Player ${i + 1}`}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handlePublish}
          disabled={!validation.ok || publishing}
          className={`px-5 py-2.5 rounded-lg font-semibold transition-colors ${
            validation.ok && !publishing
              ? "bg-green-600 hover:bg-green-500 text-white"
              : "bg-gray-700 text-gray-400 cursor-not-allowed"
          }`}
        >
          {publishing ? "Publishing..." : "Publish Pack"}
        </button>
        {!validation.ok && (
          <span className="text-sm text-gray-400">{validation.reason}</span>
        )}
        {publishMessage && (
          <span
            role="status"
            className={`text-sm ${publishMessage.kind === "ok" ? "text-green-400" : "text-red-400"}`}
          >
            {publishMessage.text}
          </span>
        )}
      </div>
    </section>
  );
}
