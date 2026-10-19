import type { TurnTimerProps } from "./types";

const RADIUS = 56;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function TurnTimer({ timeLeft, total }: TurnTimerProps) {
  const urgent = timeLeft <= 5;
  const offset = CIRCUMFERENCE - (Math.max(timeLeft, 0) / total) * CIRCUMFERENCE;

  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      <svg viewBox="0 0 128 128" className="absolute inset-0 w-full h-full -rotate-90" aria-hidden="true">
        <circle cx="64" cy="64" r={RADIUS} strokeWidth="8" fill="transparent" className="stroke-slate-800" />
        <circle
          cx="64"
          cy="64"
          r={RADIUS}
          strokeWidth="8"
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${urgent ? "stroke-rose-500" : "stroke-gold-500"}`}
        />
      </svg>
      <div className="relative flex flex-col items-center">
        <div
          className={`font-mono font-extrabold text-3xl ${urgent ? "text-rose-400" : "text-white"}`}
          aria-label={`${timeLeft} seconds remaining`}
          aria-live={urgent ? "assertive" : "off"}
        >
          {timeLeft}s
        </div>
        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest" aria-hidden="true">
          Seconds
        </span>
      </div>
    </div>
  );
}
