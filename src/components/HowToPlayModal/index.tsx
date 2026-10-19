import { useEffect, useId, useRef } from "react";
import { BTN_LG, BTN_PRIMARY } from "../../theme";
import type { HowToPlayModalProps } from "./types";

export default function HowToPlayModal({ title, rules, onClose }: HowToPlayModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      data-testid="how-to-play-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 font-body"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md glass-panel border-pitch-500/30 shadow-stadium rounded-3xl p-6 sm:p-8 text-white text-left"
      >
        <h2 id={titleId} className="text-xl font-extrabold mb-5">
          How to play: {title}
        </h2>
        <ol className="space-y-3 text-slate-300 text-sm leading-relaxed mb-6">
          {rules.map((rule, i) => (
            <li key={rule} className="flex gap-3">
              <span aria-hidden="true" className="w-6 h-6 shrink-0 rounded-full bg-pitch-500/20 text-pitch-400 text-xs flex items-center justify-center font-bold">
                {i + 1}
              </span>
              <span className="pt-0.5">{rule}</span>
            </li>
          ))}
        </ol>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className={`${BTN_PRIMARY} ${BTN_LG} w-full`}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
