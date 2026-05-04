import { useEffect, useMemo, useState } from "react";
import { searchClubs } from "../../api/adminApi";
import { isPackScheduled, publishPack, getClubCandidatePool } from "../../api/packAdminApi";
import { validatePackForPublish, type PackBuilderState } from "./packBuilderValidation";
import { rankClubCandidates, type RankedCandidate } from "./packCandidateRanker";
import { SEED_PLAYERS } from "../../data/seedPlayers";
import type { Player } from "../../types";

const PACK_SIZE = 10;
const CANDIDATE_LIMIT = 30;
const SEED_PLAYER_IDS = new Set(SEED_PLAYERS.map((p) => p.id));

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

function candidateAsPlayer(c: RankedCandidate): Player {
  return {
    id: c.id,
    name: c.name,
    thumbnail: c.thumbnail,
    nationality: "",
  };
}

export default function PackBuilder() {
  const [club, setClub] = useState<ClubOption | null>(null);
  const [clubQuery, setClubQuery] = useState("");
  const [clubResults, setClubResults] = useState<ClubOption[]>([]);
  const [candidates, setCandidates] = useState<RankedCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [date, setDate] = useState<string>(getDefaultDate);
  const [alreadyScheduled, setAlreadyScheduled] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // Search clubs.
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

  // Load candidates when a club is picked.
  useEffect(() => {
    let cancelled = false;
    if (!club) {
      setCandidates([]);
      setSelectedIds([]);
      return;
    }
    setLoadingCandidates(true);
    getClubCandidatePool(club.id).then((pool) => {
      if (cancelled) return;
      const ranked = rankClubCandidates(pool, SEED_PLAYER_IDS, { limit: CANDIDATE_LIMIT });
      setCandidates(ranked);
      setLoadingCandidates(false);
    });
    return () => { cancelled = true; };
  }, [club]);

  // Check date conflict.
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

  const candidateById = useMemo(
    () => new Map(candidates.map((c) => [c.id, c])),
    [candidates],
  );

  const selectedPlayers = useMemo(
    () => selectedIds.map((id) => candidateById.get(id)).filter((c): c is RankedCandidate => !!c),
    [selectedIds, candidateById],
  );

  const validation = validatePackForPublish({
    clubId: club?.id ?? null,
    players: [
      ...selectedPlayers.map(candidateAsPlayer),
      ...Array(Math.max(0, PACK_SIZE - selectedPlayers.length)).fill(null),
    ],
    date,
    alreadyScheduled,
  } as PackBuilderState);

  function addCandidate(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id) || prev.length >= PACK_SIZE) return prev;
      return [...prev, id];
    });
  }

  function removeSelected(id: string) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }

  async function handlePublish() {
    if (!validation.ok || !club) return;
    setPublishing(true);
    setPublishMessage(null);
    const result = await publishPack(date, club.id, selectedIds);
    setPublishing(false);
    if (result.ok) {
      setPublishMessage({ kind: "ok", text: `Pack published for ${date}` });
      setSelectedIds([]);
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

      {club && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Candidate pool */}
          <div aria-label="Candidates" className="bg-gray-900 border border-gray-700 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center justify-between">
              <span>Candidates</span>
              <span className="text-xs text-gray-500">{candidates.length} ranked</span>
            </h3>
            {loadingCandidates ? (
              <p className="text-gray-500 text-sm">Loading candidates...</p>
            ) : candidates.length === 0 ? (
              <p className="text-gray-500 text-sm">No eligible candidates for this club.</p>
            ) : (
              <ul className="space-y-1 max-h-[36rem] overflow-y-auto">
                {candidates.map((c) => {
                  const isSelected = selectedIds.includes(c.id);
                  const atCapacity = selectedIds.length >= PACK_SIZE;
                  return (
                    <li
                      key={c.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded ${
                        isSelected ? "bg-green-900/30 opacity-50" : "hover:bg-gray-800"
                      }`}
                    >
                      <img src={c.thumbnail} alt="" className="w-8 h-8 rounded-full object-cover bg-gray-700 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{c.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <span>{c.tenureLabel || "—"}</span>
                          {c.inSeedList && <span className="text-yellow-500">★ seed</span>}
                          {c.hasTopLeagueElsewhere && <span className="text-blue-400">top-5</span>}
                          {c.isLoan && <span className="text-amber-400">loan</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addCandidate(c.id)}
                        disabled={isSelected || atCapacity}
                        aria-label={`Add ${c.name}`}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          isSelected || atCapacity
                            ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                            : "bg-green-700 hover:bg-green-600 text-white"
                        }`}
                      >
                        {isSelected ? "Added" : "Add"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Selected 10 */}
          <div aria-label="Selected" className="bg-gray-900 border border-gray-700 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center justify-between">
              <span>Selected</span>
              <span className="text-xs text-gray-500">{selectedIds.length} / {PACK_SIZE}</span>
            </h3>
            <ul className="space-y-1">
              {Array.from({ length: PACK_SIZE }, (_, i) => {
                const id = selectedIds[i];
                const player = id ? candidateById.get(id) : undefined;
                return (
                  <li key={i} className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-800/50">
                    <span className="w-5 text-xs text-gray-500 text-right shrink-0">{i + 1}.</span>
                    {player ? (
                      <>
                        <img src={player.thumbnail} alt="" className="w-7 h-7 rounded-full object-cover bg-gray-700 shrink-0" />
                        <span className="flex-1 text-sm text-white truncate">{player.name}</span>
                        <button
                          type="button"
                          onClick={() => removeSelected(player.id)}
                          aria-label={`Remove ${player.name}`}
                          className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-red-700 text-white transition-colors"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <span className="flex-1 text-sm text-gray-600 italic">empty slot</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

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
