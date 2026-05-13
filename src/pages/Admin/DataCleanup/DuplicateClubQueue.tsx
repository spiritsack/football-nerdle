import { useState, useEffect } from "react";
import { useClubCandidates } from "./useMergeCandidates";
import { findSharedPlayersForClubs } from "../../../api/dataCleanupApi";
import { pickDefaultWinner, scoreColor, isFieldConflict } from "./helpers";
import type { ClubCandidate, WinnerSide, SharedPlayer } from "./types";

function ScoreChips({ c }: { c: ClubCandidate }) {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      <span className="bg-gray-700 px-2 py-0.5 rounded">name {c.name_sim.toFixed(2)}</span>
      {c.same_country && <span className="bg-purple-900 text-purple-300 px-2 py-0.5 rounded">same country</span>}
      {c.shared_player_count > 0 && (
        <span className="bg-blue-900 text-blue-300 px-2 py-0.5 rounded">
          {c.shared_player_count} shared players ({(c.roster_overlap * 100).toFixed(0)}%)
        </span>
      )}
    </div>
  );
}

function ClubSide({ c, side, selected, onSelect }: {
  c: ClubCandidate;
  side: "a" | "b";
  selected: boolean;
  onSelect: () => void;
}) {
  const name = side === "a" ? c.name_a : c.name_b;
  const badge = side === "a" ? c.badge_a : c.badge_b;
  const country = side === "a" ? c.country_a : c.country_b;
  const count = side === "a" ? c.player_count_a : c.player_count_b;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex-1 p-3 rounded-lg border-2 text-left transition-colors ${
        selected
          ? "border-green-500 bg-green-900/20"
          : "border-gray-700 bg-gray-800 hover:border-gray-500"
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        {badge ? (
          <img src={badge} alt="" className="w-10 h-10 object-contain" />
        ) : (
          <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center text-gray-400 text-sm">
            {name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <div className="font-semibold text-white">{name}</div>
          <div className={`text-xs ${isFieldConflict(c.country_a, c.country_b) ? "text-red-400" : "text-gray-400"}`}>{country || "—"}</div>
        </div>
      </div>
      <div className="text-xs text-gray-300">Players: {count}</div>
      {selected && <div className="mt-2 text-green-400 text-xs font-semibold">WINNER (keep)</div>}
    </button>
  );
}

function RosterOverlapPreview({ clubIdA, clubIdB, nameA, nameB }: {
  clubIdA: string;
  clubIdB: string;
  nameA: string;
  nameB: string;
}) {
  const [players, setPlayers] = useState<SharedPlayer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    let active = true;
    findSharedPlayersForClubs(clubIdA, clubIdB).then((data) => {
      if (active) { setPlayers(data); setLoaded(true); }
    });
    return () => { active = false; };
  }, [clubIdA, clubIdB, expanded]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
      >
        {expanded ? "Hide" : "Show"} shared players
      </button>
      {expanded && (
        <div className="mt-2">
          {!loaded ? (
            <p className="text-xs text-gray-500">Loading...</p>
          ) : players.length === 0 ? (
            <p className="text-xs text-gray-500">No shared players.</p>
          ) : (
            <div className="bg-gray-900/50 rounded-lg p-2 space-y-1 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 font-medium px-1">
                <span>Player</span>
                <span>{nameA}</span>
                <span>{nameB}</span>
              </div>
              {players.map((p) => (
                <div key={p.player_id} className="grid grid-cols-3 gap-2 text-xs text-gray-300 px-1">
                  <span className="text-white">{p.player_name}</span>
                  <span>{p.years_at_a}</span>
                  <span>{p.years_at_b}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CandidateRow({ c, onMerge, onDismiss }: {
  c: ClubCandidate;
  onMerge: (winnerId: string, loserId: string) => void;
  onDismiss: (idA: string, idB: string) => void;
}) {
  const [winner, setWinner] = useState<WinnerSide>(pickDefaultWinner(c));
  const [confirming, setConfirming] = useState(false);

  const winnerId = winner === "a" ? c.id_a : c.id_b;
  const loserId = winner === "a" ? c.id_b : c.id_a;

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <ScoreChips c={c} />
        <span className={`text-lg font-bold ${scoreColor(c.score)}`}>{c.score.toFixed(2)}</span>
      </div>
      <div className="flex gap-3">
        <ClubSide c={c} side="a" selected={winner === "a"} onSelect={() => setWinner("a")} />
        <ClubSide c={c} side="b" selected={winner === "b"} onSelect={() => setWinner("b")} />
      </div>
      {c.shared_player_count > 0 && (
        <RosterOverlapPreview
          clubIdA={c.id_a}
          clubIdB={c.id_b}
          nameA={c.name_a}
          nameB={c.name_b}
        />
      )}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => onDismiss(c.id_a, c.id_b)}
          className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-lg transition-colors"
        >
          Not duplicate
        </button>
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Merge
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-red-400">Delete {winner === "a" ? c.name_b : c.name_a}?</span>
            <button
              type="button"
              onClick={() => { setConfirming(false); onMerge(winnerId, loserId); }}
              className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DuplicateClubQueue() {
  const { candidates, loading, error, refresh, dismiss, merge } = useClubCandidates();
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleMerge = async (winnerId: string, loserId: string) => {
    const result = await merge(winnerId, loserId);
    if (result) {
      setLastResult(`Merged: ${result.stints_moved} stints moved, ${result.stints_dropped} dropped, ${result.players_updated} players updated`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Duplicate Clubs ({candidates.length})</h3>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {lastResult && <p className="text-green-400 text-sm">{lastResult}</p>}
      {!loading && candidates.length === 0 && (
        <p className="text-gray-500 text-sm">No duplicate candidates found.</p>
      )}
      {candidates.map((c) => (
        <CandidateRow
          key={`${c.id_a}-${c.id_b}`}
          c={c}
          onMerge={handleMerge}
          onDismiss={dismiss}
        />
      ))}
    </div>
  );
}
