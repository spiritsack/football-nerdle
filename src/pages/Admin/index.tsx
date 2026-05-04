import { useState } from "react";
import { Link } from "react-router-dom";
import { useAdminAuth } from "../../api/useAdminAuth";
import ScheduleManager from "./ScheduleManager";
import PackBuilder from "./PackBuilder";

type AdminTab = "schedule" | "pack";

function SignInForm({ onSignIn, error }: { onSignIn: (email: string, password: string) => void; error: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSignIn(email, password);
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-white text-xl font-bold mb-4">Admin Sign In</h1>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500 mb-3"
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500 mb-3"
        />
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button
          type="submit"
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
        >
          Sign In
        </button>
      </form>
    </div>
  );
}

export default function Admin() {
  const { session, loading, error, signIn, signOut } = useAdminAuth();
  const [tab, setTab] = useState<AdminTab>("schedule");

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <SignInForm onSignIn={signIn} error={error} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-3xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Admin</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-500 text-sm">{session.user.email}</span>
            <button onClick={signOut} className="text-gray-400 hover:text-white text-sm transition-colors">
              Sign Out
            </button>
            <Link to="/" className="text-gray-400 hover:text-white text-sm transition-colors">
              ← Home
            </Link>
          </div>
        </div>
        <nav role="tablist" aria-label="Admin sections" className="flex gap-2 border-b border-gray-700 mb-6">
          <button
            role="tab"
            aria-selected={tab === "schedule"}
            onClick={() => setTab("schedule")}
            className={`px-4 py-2 -mb-px border-b-2 transition-colors ${
              tab === "schedule"
                ? "border-green-500 text-white"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            Schedule
          </button>
          <button
            role="tab"
            aria-selected={tab === "pack"}
            onClick={() => setTab("pack")}
            className={`px-4 py-2 -mb-px border-b-2 transition-colors ${
              tab === "pack"
                ? "border-green-500 text-white"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            Pack Builder
          </button>
        </nav>

        {tab === "schedule" && <ScheduleManager />}
        {tab === "pack" && <PackBuilder />}
      </div>
    </div>
  );
}
