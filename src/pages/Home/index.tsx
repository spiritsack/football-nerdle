import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="py-12">
        <h1 className="text-5xl font-bold text-center">Football Nerdle</h1>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 gap-6 max-w-lg mx-auto w-full">
        <Link
          to="/battle"
          className="w-full bg-gray-800 border border-gray-600 hover:border-green-500 rounded-xl p-6 text-center transition-colors block"
        >
          <h2 className="text-2xl font-bold mb-2">Battle Mode</h2>
          <p className="text-gray-400">
            Name footballers who played together to build the longest chain. 15 seconds per turn.
          </p>
        </Link>

        <Link
          to="/guess"
          className="w-full bg-gray-800 border border-gray-600 hover:border-green-500 rounded-xl p-6 text-center transition-colors block"
        >
          <h2 className="text-2xl font-bold mb-2">Daily Guess the Player</h2>
          <p className="text-gray-400">
            See a player's club history and guess who it is. 5 attempts to get it right.
          </p>
        </Link>

        <Link
          to="/guess?mode=random"
          className="w-full bg-gray-800 border border-gray-600 hover:border-green-500 rounded-xl p-6 text-center transition-colors block"
        >
          <h2 className="text-2xl font-bold mb-2">Random Guess the Player</h2>
          <p className="text-gray-400">
            Practice with a random player from top European clubs.
          </p>
        </Link>
      </main>
    </div>
  );
}
