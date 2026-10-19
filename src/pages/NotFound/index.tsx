import { Link } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import AppShell from "../../components/AppShell";
import { BTN_LG, BTN_PRIMARY } from "../../theme";

export default function NotFound() {
  return (
    <AppShell>
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-12">
        <div className="w-full max-w-2xl glass-panel border-rose-500/20 shadow-stadium rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center gap-6">
          <div
            aria-hidden="true"
            className="w-20 h-28 sm:w-24 sm:h-32 rounded-xl bg-gradient-to-tr from-rose-600 to-rose-500 border-2 border-rose-400 shadow-2xl shadow-rose-500/30 -rotate-12 flex items-center justify-center"
          >
            <span className="text-[10px] font-extrabold text-slate-950 tracking-widest uppercase">Red card</span>
          </div>
          <div className="space-y-2">
            <p aria-hidden="true" className="font-display font-bold text-7xl sm:text-8xl leading-none text-white">404</p>
            <h1 className="font-display font-bold uppercase tracking-wide text-4xl sm:text-5xl leading-none text-white">Page not found</h1>
            <p className="text-slate-300 max-w-md pt-2">
              That page doesn't exist. It may have been mistyped or moved.
            </p>
          </div>
          <Link to="/" className={`${BTN_PRIMARY} ${BTN_LG}`}>
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Back to Home
          </Link>
        </div>
      </main>
    </AppShell>
  );
}
