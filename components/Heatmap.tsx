"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

function getLastNDays(n: number): string[] {
  const days: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(d);
    day.setDate(d.getDate() - i);
    days.push(day.toISOString().slice(0, 10));
  }
  return days;
}

export default function Heatmap({ bookId }: { bookId: string }) {
  const sessions =
    useLiveQuery(() => db.sessions.where("bookId").equals(bookId).toArray(), [bookId]) ?? [];
  const days = getLastNDays(70);
  const map = new Map(sessions.map((s) => [s.date, s.wordsWritten]));

  const intensity = (words: number) => {
    if (words <= 0) return "bg-[var(--bg-dim)]";
    if (words < 100) return "bg-sage/30";
    if (words < 300) return "bg-sage/60";
    if (words < 600) return "bg-sage";
    return "bg-sepia";
  };

  // current streak
  let streak = 0;
  const todaySorted = [...days].reverse();
  for (const d of todaySorted) {
    const words = map.get(d) ?? 0;
    if (words > 0) streak++;
    else break;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-ink-soft">Last 10 weeks</span>
        <span className="text-xs font-semibold text-sepia">
          {streak > 0 ? `🔥 ${streak} day streak` : "Start your streak today"}
        </span>
      </div>
      <div className="grid grid-flow-col grid-rows-7 gap-1">
        {days.map((d) => (
          <div
            key={d}
            title={`${d}: ${map.get(d) ?? 0} words`}
            className={`h-3 w-3 rounded-sm ${intensity(map.get(d) ?? 0)}`}
          />
        ))}
      </div>
    </div>
  );
}
