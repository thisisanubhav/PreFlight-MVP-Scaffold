import Link from "next/link";
import { LogoMark, UserIcon } from "@/components/icons";

type BackendStatus = "checking" | "connected" | "offline";

const STATUS_LABEL: Record<BackendStatus, string> = {
  checking: "Checking...",
  connected: "Connected",
  offline: "Offline",
};

const STATUS_DOT: Record<BackendStatus, string> = {
  checking: "bg-neutral-300",
  connected: "bg-green-500",
  offline: "bg-red-500",
};

// backendStatus is undefined on pages that don't check backend health (e.g.
// the report page, which already has its data) — the status readout is
// omitted entirely rather than showing a stale/meaningless state.
function resolveStatus(backendUp?: boolean | null): BackendStatus | undefined {
  if (backendUp === undefined) return undefined;
  if (backendUp === null) return "checking";
  return backendUp ? "connected" : "offline";
}

export default function Header({ backendStatus }: { backendStatus?: boolean | null }) {
  const status = resolveStatus(backendStatus);

  return (
    <header className="border-b border-neutral-200/80 bg-gradient-to-r from-white via-white to-yt-red-light/50 px-5 py-3 backdrop-blur sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="PreFlight home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-900 text-white shadow-md shadow-neutral-300 transition-transform group-hover:-rotate-6 group-hover:scale-105">
            <LogoMark className="h-5 w-5" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-lg font-black tracking-tight text-neutral-900">Pre<span className="text-yt-red">Flight</span></span>
            <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-neutral-400">Creator intelligence</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {status && (
            <span className="flex items-center gap-1.5" title="Backend API status">
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
              <span className="text-xs text-neutral-400">{STATUS_LABEL[status]}</span>
            </span>
          )}
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-colors hover:bg-neutral-200">
            <UserIcon className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
      <p className="mx-auto mt-1 max-w-6xl text-xs text-neutral-400">
        Know if your video will hold attention &mdash; before you publish it.
      </p>
    </header>
  );
}
