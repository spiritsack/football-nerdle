import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ADMIN_SESSION_KEY } from "./constants";
import ScheduleManager from "./ScheduleManager";

const PASSPHRASE = import.meta.env.VITE_ADMIN_PASSPHRASE ?? "";

function PassphraseGate({ onAuth }: { onAuth: () => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input === PASSPHRASE) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      onAuth();
    } else {
      setError(true);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-white text-xl font-bold mb-4">Admin Access</h1>
        <input
          type="password"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false); }}
          placeholder="Passphrase"
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500 mb-3"
          autoFocus
        />
        {error && <p className="text-red-400 text-sm mb-3">Incorrect passphrase</p>}
        <button
          type="submit"
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
        >
          Enter
        </button>
      </form>
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem(ADMIN_SESSION_KEY) === "1" && PASSPHRASE !== "",
  );

  const handleAuth = useCallback(() => setAuthed(true), []);

  if (!PASSPHRASE) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <p className="text-gray-400">VITE_ADMIN_PASSPHRASE not configured.</p>
      </div>
    );
  }

  if (!authed) {
    return <PassphraseGate onAuth={handleAuth} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-3xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Admin</h1>
          <Link to="/" className="text-gray-400 hover:text-white text-sm transition-colors">
            ← Back to Home
          </Link>
        </div>
        <ScheduleManager />
      </div>
    </div>
  );
}
