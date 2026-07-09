import { Feather } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="paper-grain flex min-h-screen items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <Feather className="mx-auto mb-4 text-sepia" size={32} />
        <h1 className="font-display text-2xl font-semibold">
          You&apos;re offline
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          No connection right now, but everything you&apos;ve written is safe
          on this device. Your desk will sync again once you&apos;re back
          online.
        </p>
      </div>
    </div>
  );
}
