import { useState } from "react";
import { useOrphanPlayers, useOrphanClubs } from "./useMergeCandidates";
import type { OrphanPlayer, OrphanClub } from "./types";

function OrphanPlayerRow({ p, onDelete }: {
  p: OrphanPlayer;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-3">
      <div className="flex items-center gap-3">
        {p.thumbnail ? (
          <img src={p.thumbnail} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 text-xs">?</div>
        )}
        <div>
          <div className="text-white text-sm font-medium">{p.name}</div>
          <div className="text-xs text-gray-400">
            {[p.nationality, p.date_born, p.data_source].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="px-3 py-1 text-xs text-red-400 hover:text-red-300 border border-red-800 rounded transition-colors"
        >
          Delete
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setConfirming(false); onDelete(p.id); }}
            className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="px-3 py-1 text-xs text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function OrphanClubRow({ c, onDelete }: {
  c: OrphanClub;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-3">
      <div className="flex items-center gap-3">
        {c.badge ? (
          <img src={c.badge} alt="" className="w-8 h-8 object-contain" />
        ) : (
          <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center text-gray-400 text-xs">
            {c.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <div className="text-white text-sm font-medium">{c.name}</div>
          <div className="text-xs text-gray-400">{c.country || "—"}</div>
        </div>
      </div>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="px-3 py-1 text-xs text-red-400 hover:text-red-300 border border-red-800 rounded transition-colors"
        >
          Delete
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setConfirming(false); onDelete(c.id); }}
            className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="px-3 py-1 text-xs text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export default function OrphanQueue() {
  const players = useOrphanPlayers();
  const clubs = useOrphanClubs();

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Orphan Players ({players.orphans.length})</h3>
          <button
            type="button"
            onClick={players.refresh}
            disabled={players.loading}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {players.loading ? "Loading..." : "Refresh"}
          </button>
        </div>
        <p className="text-xs text-gray-500">Players with zero club stints.</p>
        {players.error && <p className="text-red-400 text-sm">{players.error}</p>}
        {!players.loading && players.orphans.length === 0 && (
          <p className="text-gray-500 text-sm">No orphan players found.</p>
        )}
        {players.orphans.map((p) => (
          <OrphanPlayerRow key={p.id} p={p} onDelete={players.remove} />
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Orphan Clubs ({clubs.orphans.length})</h3>
          <button
            type="button"
            onClick={clubs.refresh}
            disabled={clubs.loading}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {clubs.loading ? "Loading..." : "Refresh"}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Clubs with zero player stints, not used in any pack or as a current club.
        </p>
        {clubs.error && <p className="text-red-400 text-sm">{clubs.error}</p>}
        {!clubs.loading && clubs.orphans.length === 0 && (
          <p className="text-gray-500 text-sm">No orphan clubs found.</p>
        )}
        {clubs.orphans.map((c) => (
          <OrphanClubRow key={c.id} c={c} onDelete={clubs.remove} />
        ))}
      </div>
    </div>
  );
}
