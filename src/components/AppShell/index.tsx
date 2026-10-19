import SiteHeader from "../SiteHeader";
import type { AppShellProps } from "./types";

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative isolate min-h-screen bg-night font-body text-slate-50 flex flex-col selection:bg-pitch-500 selection:text-white">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-stadium pointer-events-none" />
      <SiteHeader />
      <div className="flex-1 flex flex-col w-full">{children}</div>
    </div>
  );
}
