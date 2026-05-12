import { useState } from "react";
import { useFragmentedStints } from "./useMergeCandidates";
import type { StintFragment } from "./types";

function FragmentRow({ f, onMerge }: {
  f: StintFragment;
  onMerge: (playerId: string, clubId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-semibold text-white">{f.player_name}</span>
          <span className="text-gray-400 mx-2">at</span>
          <span className="font-semibold text-white">{f.club_name}</span>
        </div>
        <span className="text-xs bg-amber-900 text-amber-300 px-2 py-0.5 rounded">
          {f.stint_count} stints
        </span>
      </div>
      <div className="text-sm text-gray-300">
        Range: {f.earliest_joined || "?"} — {f.latest_departed || "present"}
      </div>
      <div className="flex gap-2 justify-end">
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Merge stints
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-blue-400">
              Combine into {f.earliest_joined || "?"} — {f.latest_departed || "present"}?
            </span>
            <button
              type="button"
              onClick={() => { setConfirming(false); onMerge(f.player_id, f.club_id); }}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
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

export default function StintCleanupQueue() {
  const { fragments, loading, error, refresh, mergeStints } = useFragmentedStints();
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleMerge = async (playerId: string, clubId: string) => {
    const result = await mergeStints(playerId, clubId);
    if (result) {
      setLastResult(
        `Merged ${result.stints_merged} stints → ${result.kept_joined || "?"} — ${result.kept_departed || "present"}`,
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Fragmented Stints ({fragments.length})</h3>
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
      {!loading && fragments.length === 0 && (
        <p className="text-gray-500 text-sm">No fragmented stints found.</p>
      )}
      {fragments.map((f) => (
        <FragmentRow
          key={`${f.player_id}-${f.club_id}`}
          f={f}
          onMerge={handleMerge}
        />
      ))}
    </div>
  );
}
