import { useState } from "react";
import DuplicatePlayerQueue from "./DuplicatePlayerQueue";
import DuplicateClubQueue from "./DuplicateClubQueue";
import type { CleanupTab } from "./types";

export default function DataCleanup() {
  const [tab, setTab] = useState<CleanupTab>("players");

  return (
    <div>
      <nav className="flex gap-2 border-b border-gray-700 mb-4">
        <button
          type="button"
          onClick={() => setTab("players")}
          className={`px-3 py-1.5 -mb-px border-b-2 text-sm transition-colors ${
            tab === "players"
              ? "border-green-500 text-white"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Players
        </button>
        <button
          type="button"
          onClick={() => setTab("clubs")}
          className={`px-3 py-1.5 -mb-px border-b-2 text-sm transition-colors ${
            tab === "clubs"
              ? "border-green-500 text-white"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Clubs
        </button>
      </nav>
      {tab === "players" && <DuplicatePlayerQueue />}
      {tab === "clubs" && <DuplicateClubQueue />}
    </div>
  );
}
