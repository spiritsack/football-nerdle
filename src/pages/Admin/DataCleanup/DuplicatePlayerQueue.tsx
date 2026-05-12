import { useState } from "react";
import { usePlayerCandidates } from "./useMergeCandidates";
import { pickDefaultWinner, scoreColor, isFieldConflict } from "./helpers";
import type { PlayerCandidate, WinnerSide } from "./types";

function ScoreChips({ c }: { c: PlayerCandidate }) {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      <span className="bg-gray-700 px-2 py-0.5 rounded">name {c.name_sim.toFixed(2)}</span>
      {c.dob_match && <span className="bg-blue-900 text-blue-300 px-2 py-0.5 rounded">DOB match</span>}
      {c.same_nationality && <span className="bg-purple-900 text-purple-300 px-2 py-0.5 rounded">same nationality</span>}
      {c.cross_source && <span className="bg-amber-900 text-amber-300 px-2 py-0.5 rounded">cross-source</span>}
    </div>
  );
}

function PlayerSide({ c, side, selected, onSelect }: {
  c: PlayerCandidate;
  side: "a" | "b";
  selected: boolean;
  onSelect: () => void;
}) {
  const name = side === "a" ? c.name_a : c.name_b;
  const thumb = side === "a" ? c.thumbnail_a : c.thumbnail_b;
  const dob = side === "a" ? c.dob_a : c.dob_b;
  const nat = side === "a" ? c.nationality_a : c.nationality_b;
  const pos = side === "a" ? c.position_a : c.position_b;
  const src = side === "a" ? c.source_a : c.source_b;
  const tmId = side === "a" ? c.transfermarkt_id_a : c.transfermarkt_id_b;
  const stints = side === "a" ? c.stint_count_a : c.stint_count_b;

  const conflict = (a: string, b: string) => isFieldConflict(a, b) ? "text-red-400" : "";

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
        {thumb ? (
          <img src={thumb} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 text-sm">?</div>
        )}
        <div>
          <div className="font-semibold text-white">{name}</div>
          <div className="text-xs text-gray-400">{src}{tmId ? ` · TM#${tmId}` : ""}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-300">
        <span className={conflict(c.dob_a, c.dob_b)}>DOB: {dob || "—"}</span>
        <span className={conflict(c.nationality_a, c.nationality_b)}>Nationality: {nat || "—"}</span>
        <span className={conflict(c.position_a, c.position_b)}>Position: {pos || "—"}</span>
        <span>Stints: {stints}</span>
      </div>
      {selected && <div className="mt-2 text-green-400 text-xs font-semibold">WINNER (keep)</div>}
    </button>
  );
}

function CandidateRow({ c, onMerge, onDismiss }: {
  c: PlayerCandidate;
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
        <PlayerSide c={c} side="a" selected={winner === "a"} onSelect={() => setWinner("a")} />
        <PlayerSide c={c} side="b" selected={winner === "b"} onSelect={() => setWinner("b")} />
      </div>
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

export default function DuplicatePlayerQueue() {
  const { candidates, loading, error, refresh, dismiss, merge } = usePlayerCandidates();
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleMerge = async (winnerId: string, loserId: string) => {
    const result = await merge(winnerId, loserId);
    if (result) {
      setLastResult(`Merged: ${result.stints_moved} stints moved, ${result.stints_dropped} dropped, ${result.schedule_moved} schedule entries moved`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Duplicate Players ({candidates.length})</h3>
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
