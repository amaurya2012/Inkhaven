import { v4 as uuidv4 } from "uuid";

export const newId = () => uuidv4();

export function countWords(text: string): number {
  const stripped = text.replace(/<[^>]*>/g, " ").trim();
  if (!stripped) return 0;
  return stripped.split(/\s+/).filter(Boolean).length;
}

export function todayStr(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function readingTime(words: number): string {
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}
