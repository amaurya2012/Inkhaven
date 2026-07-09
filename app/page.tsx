"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { newId, formatDate, todayStr } from "@/lib/utils";
import { Plus, BookOpen, Trash2, Pencil, Feather, Sun, Coffee, Moon, Flame } from "lucide-react";
import Heatmap from "@/components/Heatmap";
import { useUIStore, type Theme } from "@/store/useUIStore";

const QUOTES = [
  "The scariest moment is always just before you start. — Stephen King",
  "You can always edit a bad page. You can't edit a blank page. — Jodi Picoult",
  "Write the story that only you can tell.",
  "A word after a word after a word is power. — Margaret Atwood",
  "Start writing, no matter what. The water does not flow until the faucet is turned on. — Louis L'Amour",
  "The first draft is just you telling yourself the story. — Terry Pratchett",
  "Every book was once a blank page.",
];

export default function Dashboard() {
  const books = useLiveQuery(() => db.books.orderBy("updatedAt").reverse().toArray()) ?? [];
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [target, setTarget] = useState(50000);
  const { theme, setTheme } = useUIStore();

  const quote = QUOTES[new Date().getDate() % QUOTES.length];

  const wordStats = useLiveQuery(async () => {
    const scenes = await db.scenes.toArray();
    const byBook: Record<string, number> = {};
    let lifetime = 0;
    scenes.forEach((s) => {
      byBook[s.bookId] = (byBook[s.bookId] || 0) + s.wordCount;
      lifetime += s.wordCount;
    });
    return { byBook, lifetime };
  }, []) ?? { byBook: {}, lifetime: 0 };

  const stats = useLiveQuery(async () => {
    const sessions = await db.sessions.toArray();
    const byDate: Record<string, number> = {};
    sessions.forEach((s) => {
      byDate[s.date] = (byDate[s.date] || 0) + s.wordsWritten;
    });
    const today = todayStr();
    const todayWords = Math.max(0, byDate[today] || 0);

    let streak = 0;
    const cursor = new Date();
    if (!byDate[todayStr()] || byDate[todayStr()] <= 0) {
      cursor.setDate(cursor.getDate() - 1);
    }
    for (let i = 0; i < 3650; i++) {
      const ds = cursor.toISOString().slice(0, 10);
      if (byDate[ds] > 0) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return { todayWords, streak };
  }, []) ?? { todayWords: 0, streak: 0 };

  const themeIcon: Record<Theme, React.ReactNode> = {
    light: <Sun size={15} />,
    dark: <Moon size={15} />,
    sepia: <Coffee size={15} />,
  };

  const submitBook = async () => {
    if (!title.trim()) return;
    if (editingId) {
      await db.books.update(editingId, {
        title: title.trim(),
        author: author.trim(),
        targetWordCount: target,
        updatedAt: Date.now(),
      });
    } else {
      const id = newId();
      await db.books.add({
        id,
        title: title.trim(),
        author: author.trim(),
        targetWordCount: target,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    resetForm();
  };

  const resetForm = () => {
    setTitle("");
    setAuthor("");
    setTarget(50000);
    setShowNew(false);
    setEditingId(null);
  };

  const startEdit = (book: (typeof books)[number], e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(book.id);
    setTitle(book.title);
    setAuthor(book.author || "");
    setTarget(book.targetWordCount);
    setShowNew(true);
  };

  const deleteBook = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this book and everything in it? This cannot be undone.")) return;
    const chapters = await db.chapters.where("bookId").equals(id).toArray();
    const scenes = await db.scenes.where("bookId").equals(id).toArray();
    await db.scenes.bulkDelete(scenes.map((s) => s.id));
    await db.chapters.bulkDelete(chapters.map((c) => c.id));
    await db.characters.where("bookId").equals(id).delete();
    await db.worldNotes.where("bookId").equals(id).delete();
    await db.sessions.where("bookId").equals(id).delete();
    await db.books.delete(id);
  };

  return (
    <div className="paper-grain min-h-screen">
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-brass to-transparent" />
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sepia/10">
              <Feather className="text-sepia" size={20} />
            </div>
            <div>
              <h1 className="font-display text-4xl font-bold tracking-tight">Inkhaven</h1>
              <p className="text-sm italic text-ink-soft">a quiet desk for the book you&apos;re writing</p>
            </div>
          </div>

          <div className="flex items-center rounded-full border border-[var(--border)] p-0.5">
            {(["light", "sepia", "dark"] as Theme[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`rounded-full p-1.5 transition-colors ${
                  theme === t ? "bg-sepia text-paper" : "text-ink-soft hover:bg-[var(--bg-dim)]"
                }`}
                title={t}
              >
                {themeIcon[t]}
              </button>
            ))}
          </div>
        </div>

        <svg
          viewBox="0 0 300 16"
          className="mb-10 h-3 w-full text-[var(--border)]"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line x1="0" y1="8" x2="135" y2="8" stroke="currentColor" strokeWidth="1" />
          <circle cx="150" cy="8" r="3" className="text-brass" fill="currentColor" />
          <line x1="165" y1="8" x2="300" y2="8" stroke="currentColor" strokeWidth="1" />
        </svg>

        <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
          <div>
            {books.length === 0 && !showNew && (
              <div className="rounded-xl border border-dashed border-[var(--border)] px-8 py-14 text-center">
                <svg viewBox="0 0 120 90" className="mx-auto mb-5 h-20 w-28" aria-hidden="true">
                  <path
                    d="M60 20 C40 8 15 8 8 14 V70 C15 64 40 64 60 76 C80 64 105 64 112 70 V14 C105 8 80 8 60 20 Z"
                    fill="none"
                    stroke="currentColor"
                    className="text-sepia"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                  <line x1="60" y1="20" x2="60" y2="76" stroke="currentColor" className="text-sepia" strokeWidth="2.5" />
                  <line x1="18" y1="26" x2="46" y2="22" stroke="currentColor" className="text-sepia/40" strokeWidth="1.5" />
                  <line x1="18" y1="36" x2="46" y2="32" stroke="currentColor" className="text-sepia/40" strokeWidth="1.5" />
                  <line x1="74" y1="22" x2="102" y2="26" stroke="currentColor" className="text-sepia/40" strokeWidth="1.5" />
                  <line x1="74" y1="32" x2="102" y2="36" stroke="currentColor" className="text-sepia/40" strokeWidth="1.5" />
                  <path
                    d="M95 6 C100 14 108 22 116 24 C108 26 100 22 94 30 C92 22 88 16 80 12 C88 12 92 10 95 6 Z"
                    fill="currentColor"
                    className="text-brass"
                  />
                </svg>
                <p className="mb-1 font-display text-xl font-semibold text-ink">Your desk is empty</p>
                <p className="mb-5 text-sm text-ink-soft">Every book starts on a blank page. Begin yours.</p>
                <button
                  onClick={() => setShowNew(true)}
                  className="rounded-md bg-sepia px-5 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-sepia/90"
                >
                  Begin a new book
                </button>
              </div>
            )}

            {books.length > 0 && (
              <div className="mb-6 grid gap-3">
                {books.map((book) => {
                  const written = wordStats.byBook[book.id] || 0;
                  const pct = book.targetWordCount > 0
                    ? Math.min(100, Math.round((written / book.targetWordCount) * 100))
                    : 0;
                  return (
                  <Link
                    key={book.id}
                    href={`/write/${book.id}`}
                    className="group relative flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-dim)]/40 px-5 py-4 transition-all hover:border-sepia/50 hover:bg-[var(--bg-dim)]/70"
                  >
                    <span className="absolute inset-y-0 left-0 w-0.5 scale-y-0 bg-brass transition-transform group-hover:scale-y-100" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sepia/10">
                          <BookOpen size={17} className="text-sepia" />
                        </div>
                        <div>
                          <div className="font-display text-xl font-semibold">{book.title}</div>
                          <div className="text-xs text-ink-soft/70">
                            {book.author ? `by ${book.author} · ` : ""}last touched {formatDate(book.updatedAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => startEdit(book, e)}
                          className="text-ink-soft/30 opacity-0 transition-opacity hover:text-sepia group-hover:opacity-100"
                          title="Edit book details"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={(e) => deleteBook(book.id, e)}
                          className="text-ink-soft/30 opacity-0 transition-opacity hover:text-rose group-hover:opacity-100"
                          title="Delete book"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3.5 pl-[54px]">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-ink-soft/70">
                        <span>{written.toLocaleString("en-IN")} / {book.targetWordCount.toLocaleString("en-IN")} words</span>
                        <span className="font-medium text-sepia">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
                        <div
                          className="h-full rounded-full bg-sepia transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                  );
                })}
              </div>
            )}

            {books.length > 0 && !showNew && (
              <button
                onClick={() => setShowNew(true)}
                className="flex items-center gap-2 text-sm text-ink-soft hover:text-sepia"
              >
                <Plus size={15} /> Start another book
              </button>
            )}

            {showNew && (
              <div className="mt-4 animate-fadeIn rounded-xl border border-[var(--border)] bg-[var(--bg-dim)]/30 p-6">
                <p className="mb-4 font-display text-lg font-semibold text-ink">
                  {editingId ? "Edit book details" : "Begin a new book"}
                </p>
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-medium text-ink-soft">Book title</label>
                  <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="The name it goes by, for now"
                    className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2.5 font-display text-lg outline-none focus:border-sepia"
                  />
                </div>
                <div className="mb-5 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-soft">Author</label>
                    <input
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="Your name"
                      className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-sepia"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-soft">Target word count</label>
                    <input
                      type="number"
                      value={target}
                      onChange={(e) => setTarget(Number(e.target.value))}
                      className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-sepia"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={submitBook}
                    className="rounded-md bg-sepia px-5 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-sepia/90"
                  >
                    {editingId ? "Save changes" : "Create book"}
                  </button>
                  <button
                    onClick={resetForm}
                    className="rounded-md px-4 py-2.5 text-sm text-ink-soft hover:bg-[var(--bg-dim)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {books.length > 0 && (
              <div className="mt-10 rounded-xl border border-[var(--border)] p-5">
                <Heatmap bookId={books[0].id} />
              </div>
            )}
          </div>

          <aside className="space-y-3 lg:pt-1">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-dim)]/40 p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-soft/70">
                <Flame size={13} className="text-brass" /> Streak
              </div>
              {stats.streak > 0 ? (
                <>
                  <div className="mt-2 font-display text-2xl font-bold">
                    {stats.streak} day{stats.streak === 1 ? "" : "s"}
                  </div>
                  <div className="text-xs text-ink-soft/60">keep it going</div>
                </>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <Flame size={22} className="text-ink-soft/25" strokeWidth={1.5} />
                  <div className="text-xs text-ink-soft/60">write today to start one</div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-dim)]/40 p-4">
              <div className="text-xs font-medium uppercase tracking-wider text-ink-soft/70">Today</div>
              <div className="mt-2 font-display text-2xl font-bold">
                {stats.todayWords.toLocaleString("en-IN")}
              </div>
              <div className="text-xs text-ink-soft/60">words written</div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-dim)]/40 p-4">
              <div className="text-xs font-medium uppercase tracking-wider text-ink-soft/70">Lifetime</div>
              <div className="mt-2 font-display text-2xl font-bold">
                {wordStats.lifetime.toLocaleString("en-IN")}
              </div>
              <div className="text-xs text-ink-soft/60">words written, ever</div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-dim)]/40 p-4">
              <div className="text-xs font-medium uppercase tracking-wider text-ink-soft/70">Books</div>
              <div className="mt-2 font-display text-2xl font-bold">{books.length}</div>
              <div className="text-xs text-ink-soft/60">
                {books.length === 1 ? "in progress" : "on your desk"}
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-[var(--border)] p-4">
              <p className="font-display text-sm italic leading-relaxed text-ink-soft">
                &ldquo;{quote}&rdquo;
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}