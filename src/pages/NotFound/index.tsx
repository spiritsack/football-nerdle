import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center gap-4">
        <h1 className="text-3xl sm:text-4xl font-bold">Page not found</h1>
        <p className="text-gray-400 max-w-md">
          That page doesn't exist. It may have been mistyped or moved.
        </p>
        <Link
          to="/"
          className="mt-2 px-5 py-2.5 rounded-lg font-semibold transition-colors bg-green-600 hover:bg-green-500 text-white"
        >
          Back to Home
        </Link>
      </main>
    </div>
  );
}
