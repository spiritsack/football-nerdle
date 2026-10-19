import { useState } from "react";
import { Link } from "react-router-dom";
import { useAdminAuth } from "../../api/useAdminAuth";
import ScheduleManager from "./ScheduleManager";
import MissingLogosPanel from "./MissingLogosPanel";

function ClubLogos() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-10 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Club Logos</h2>
        <button
          onClick={() => setOpen(true)}
          disabled={open}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-default text-gray-300 hover:text-white text-sm font-medium rounded-lg transition-colors"
          title="Find logos on Wikipedia for every club without a badge"
        >
          Fill all missing
        </button>
      </div>
      {open && <MissingLogosPanel onClose={() => setOpen(false)} />}
    </div>
  );
}

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
        <ScheduleManager />
        <ClubLogos />
      </div>
    </div>
  );
}
