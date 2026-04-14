import { useState } from "react";
import { Link } from "react-router-dom";
import { useAdminAuth } from "../../api/useAdminAuth";
import ScheduleManager from "./ScheduleManager";
import PageLayout from "../../components/PageLayout";
import Button from "../../components/Button";

function SignInForm({ onSignIn, error }: { onSignIn: (email: string, password: string) => void; error: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSignIn(email, password);
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-surface-card rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-white text-xl font-bold mb-4">Admin Sign In</h1>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full px-4 py-3 bg-surface-input border border-border-default rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-border-accent mb-3"
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full px-4 py-3 bg-surface-input border border-border-default rounded-lg text-white placeholder-text-muted focus:outline-none focus:border-border-accent mb-3"
        />
        {error && <p className="text-error text-sm mb-3">{error}</p>}
        <Button type="submit" className="w-full">
          Sign In
        </Button>
      </form>
    </div>
  );
}

export default function Admin() {
  const { session, loading, error, signIn, signOut } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <SignInForm onSignIn={signIn} error={error} />;
  }

  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Admin</h1>
          <div className="flex items-center gap-4">
            <span className="text-text-subtle text-sm">{session.user.email}</span>
            <button onClick={signOut} className="text-text-muted hover:text-white text-sm transition-colors">
              Sign Out
            </button>
            <Link to="/" className="text-text-muted hover:text-white text-sm transition-colors">
              ← Home
            </Link>
          </div>
        </div>
        <ScheduleManager />
      </div>
    </PageLayout>
  );
}
