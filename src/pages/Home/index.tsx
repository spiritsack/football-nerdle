import { useState } from "react";
import { Link } from "react-router-dom";
import { getTodayString } from "../../utils/dates";
import HowToPlayModal from "../../components/HowToPlayModal";
import { HOW_TO_PLAY } from "./constants";
import { readHomeDailyState } from "./helpers";
import type { GameModeKey } from "./types";

const HOW_TO_PLAY_BUTTON_CLASS =
  "mt-4 text-sm text-gray-400 hover:text-white underline underline-offset-2 transition-colors";

export default function Home() {
  const [{ dailyDone, summary }] = useState(() => readHomeDailyState(getTodayString()));
  const [openRules, setOpenRules] = useState<GameModeKey | null>(null);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="py-12">
        <h1 className="text-5xl font-bold text-center">Football Nerdle</h1>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 gap-6 max-w-lg mx-auto w-full">
        <div className="w-full bg-gray-800 border border-gray-600 rounded-xl p-6 text-center transition-colors">
          <h2 className="text-2xl font-bold mb-2">Guess the Player</h2>
          <p className="text-gray-400 mb-4">
            See a player's club history and guess who it is. 5 attempts to get it right.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              to="/guess"
              className={`px-5 py-2.5 rounded-lg font-semibold transition-colors ${
                dailyDone
                  ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  : "bg-green-600 hover:bg-green-500 text-white"
              }`}
            >
              {dailyDone ? "Daily (Done)" : "Daily Challenge"}
            </Link>
            <Link
              to="/guess/archive"
              className={`px-5 py-2.5 rounded-lg font-semibold transition-colors ${
                dailyDone
                  ? "bg-green-600 hover:bg-green-500 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              Archive
            </Link>
          </div>
          {summary && (
            <p data-testid="daily-summary" className="mt-3 text-sm text-gray-300">
              <span className={summary.won ? "font-semibold text-green-400" : undefined}>
                {summary.headline}
              </span>
              {summary.streak !== null && (
                <>
                  {" · "}
                  <span aria-hidden="true">🔥</span> {summary.streak}-day streak
                </>
              )}
            </p>
          )}
          <button
            type="button"
            onClick={() => setOpenRules("guess")}
            className={HOW_TO_PLAY_BUTTON_CLASS}
          >
            How to play
          </button>
        </div>

        <div className="w-full bg-gray-800 border border-gray-600 hover:border-green-500 rounded-xl p-6 text-center transition-colors">
          <Link to="/battle" className="block">
            <h2 className="text-2xl font-bold mb-2">Battle Mode</h2>
            <p className="text-gray-400">
              Name footballers who played together to build the longest chain. 15 seconds per turn.
            </p>
          </Link>
          <button
            type="button"
            onClick={() => setOpenRules("battle")}
            className={HOW_TO_PLAY_BUTTON_CLASS}
          >
            How to play
          </button>
        </div>
      </main>

      {openRules && (
        <HowToPlayModal
          title={HOW_TO_PLAY[openRules].title}
          rules={HOW_TO_PLAY[openRules].rules}
          onClose={() => setOpenRules(null)}
        />
      )}
    </div>
  );
}
