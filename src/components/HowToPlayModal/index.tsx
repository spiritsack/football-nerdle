import { useEffect, useId, useRef } from "react";
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
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md bg-gray-800 border border-gray-600 rounded-xl p-6 text-white text-left"
      >
        <h2 id={titleId} className="text-xl font-bold mb-4">
          How to play: {title}
        </h2>
        <ol className="list-decimal pl-5 space-y-2 text-gray-300 mb-6">
          {rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="w-full px-5 py-2.5 rounded-lg font-semibold bg-green-600 hover:bg-green-500 text-white transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
