import { useState } from "react";
import { Link } from "react-router-dom";
import { DAILY_GUESS_KEY } from "../GuessThePlayer/constants";
import { getTodayString } from "../../utils/dates";

function isDailyCompleted(): boolean {
  try {
    const stored = localStorage.getItem(DAILY_GUESS_KEY);
    if (!stored) return false;
    const parsed = JSON.parse(stored);
    return parsed.date === getTodayString();
  } catch {
    return false;
  }
}

export default function Home() {
  const [dailyDone] = useState(isDailyCompleted);

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
              to="/guess?mode=random"
              className={`px-5 py-2.5 rounded-lg font-semibold transition-colors ${
                dailyDone
                  ? "bg-green-600 hover:bg-green-500 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              Random
            </Link>
          </div>
        </div>

        <Link
          to="/battle"
          className="w-full bg-gray-800 border border-gray-600 hover:border-green-500 rounded-xl p-6 text-center transition-colors block"
        >
          <h2 className="text-2xl font-bold mb-2">Battle Mode</h2>
          <p className="text-gray-400">
            Name footballers who played together to build the longest chain. 15 seconds per turn.
          </p>
        </Link>
      </main>
    </div>
  );
}
