import { useState } from "react";
import DuplicatePlayerQueue from "./DuplicatePlayerQueue";
import DuplicateClubQueue from "./DuplicateClubQueue";
import StintCleanupQueue from "./StintCleanupQueue";
import OrphanQueue from "./OrphanQueue";
import type { CleanupTab } from "./types";

const tabs: { key: CleanupTab; label: string }[] = [
  { key: "players", label: "Players" },
  { key: "clubs", label: "Clubs" },
  { key: "stints", label: "Stints" },
  { key: "orphans", label: "Orphans" },
];

export default function DataCleanup() {
  const [tab, setTab] = useState<CleanupTab>("players");

  return (
    <div>
      <nav className="flex gap-2 border-b border-gray-700 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 -mb-px border-b-2 text-sm transition-colors ${
              tab === t.key
                ? "border-green-500 text-white"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "players" && <DuplicatePlayerQueue />}
      {tab === "clubs" && <DuplicateClubQueue />}
      {tab === "stints" && <StintCleanupQueue />}
      {tab === "orphans" && <OrphanQueue />}
    </div>
  );
}
