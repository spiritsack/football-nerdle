import { useState } from "react";
import { Link } from "react-router-dom";
import { DAILY_GUESS_KEY } from "../GuessThePlayer/constants";
import { getTodayString } from "../../utils/dates";
import PageLayout from "../../components/PageLayout";
import Button from "../../components/Button";
import Card from "../../components/Card";

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
    <PageLayout>
      <header className="py-12">
        <h1 className="text-5xl font-bold text-center">Football Nerdle</h1>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 gap-6 max-w-lg mx-auto w-full">
        <Card className="w-full text-center transition-colors">
          <h2 className="text-2xl font-bold mb-2">Guess the Player</h2>
          <p className="text-text-muted mb-4">
            See a player's club history and guess who it is. 5 attempts to get it right.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              to="/guess"
              variant={dailyDone ? "ghost" : "primary"}
              size="sm"
              className="px-5 py-2.5"
            >
              {dailyDone ? "Daily (Done)" : "Daily Challenge"}
            </Button>
            <Button
              to="/guess?mode=random"
              variant={dailyDone ? "primary" : "ghost"}
              size="sm"
              className="px-5 py-2.5"
            >
              Random
            </Button>
          </div>
        </Card>

        <Link
          to="/battle"
          className="w-full bg-surface-card border border-border-default hover:border-border-accent rounded-xl p-6 text-center transition-colors block"
        >
          <h2 className="text-2xl font-bold mb-2">Battle Mode</h2>
          <p className="text-text-muted">
            Name footballers who played together to build the longest chain. 15 seconds per turn.
          </p>
        </Link>
      </main>
    </PageLayout>
  );
}
