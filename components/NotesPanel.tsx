"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { newId } from "@/lib/utils";
import { Plus, Trash2, User, MapPin } from "lucide-react";

export default function NotesPanel({ bookId }: { bookId: string }) {
  const [tab, setTab] = useState<"characters" | "world">("characters");
  const characters = useLiveQuery(() => db.characters.where("bookId").equals(bookId).toArray(), [bookId]) ?? [];
  const notes = useLiveQuery(() => db.worldNotes.where("bookId").equals(bookId).toArray(), [bookId]) ?? [];
  const [openId, setOpenId] = useState<string | null>(null);

  const addCharacter = async () => {
    const id = newId();
    await db.characters.add({
      id,
      bookId,
      name: "New character",
      role: "",
      description: "",
      traits: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setOpenId(id);
  };

  const addNote = async () => {
    const id = newId();
    await db.worldNotes.add({
      id,
      bookId,
      title: "New note",
      content: "",
      category: "location",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setOpenId(id);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-[var(--border)] px-3 pt-2">
        <button
          onClick={() => setTab("characters")}
          className={`flex items-center gap-1.5 rounded-t-md px-3 py-2 text-xs font-medium ${
            tab === "characters" ? "border-b-2 border-sepia text-sepia" : "text-ink-soft/60"
          }`}
        >
          <User size={13} /> Characters
        </button>
        <button
          onClick={() => setTab("world")}
          className={`flex items-center gap-1.5 rounded-t-md px-3 py-2 text-xs font-medium ${
            tab === "world" ? "border-b-2 border-sepia text-sepia" : "text-ink-soft/60"
          }`}
        >
          <MapPin size={13} /> World
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === "characters" && (
          <div className="space-y-2">
            {characters.map((c) => (
              <div key={c.id} className="rounded-lg border border-[var(--border)] p-2.5">
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 bg-transparent text-sm font-semibold outline-none"
                    value={c.name}
                    onChange={(e) => db.characters.update(c.id, { name: e.target.value })}
                  />
                  <button
                    onClick={() => db.characters.delete(c.id)}
                    className="text-ink-soft/40 hover:text-rose"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <input
                  className="mt-1 w-full bg-transparent text-xs italic text-ink-soft outline-none"
                  placeholder="role — protagonist, mentor, rival..."
                  value={c.role}
                  onChange={(e) => db.characters.update(c.id, { role: e.target.value })}
                />
                <textarea
                  className="mt-2 w-full resize-none bg-transparent text-xs leading-relaxed outline-none placeholder:text-ink-soft/40"
                  placeholder="Appearance, backstory, relationships..."
                  rows={3}
                  value={c.description}
                  onChange={(e) => db.characters.update(c.id, { description: e.target.value })}
                />
                <input
                  className="mt-1 w-full bg-transparent text-xs outline-none placeholder:text-ink-soft/40"
                  placeholder="key traits, separated by commas"
                  value={c.traits}
                  onChange={(e) => db.characters.update(c.id, { traits: e.target.value })}
                />
              </div>
            ))}
            <button
              onClick={addCharacter}
              className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-[var(--border)] py-2 text-xs text-ink-soft/60 hover:bg-[var(--bg-dim)]"
            >
              <Plus size={13} /> Add character
            </button>
          </div>
        )}

        {tab === "world" && (
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="rounded-lg border border-[var(--border)] p-2.5">
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 bg-transparent text-sm font-semibold outline-none"
                    value={n.title}
                    onChange={(e) => db.worldNotes.update(n.id, { title: e.target.value })}
                  />
                  <select
                    className="bg-transparent text-xs text-ink-soft outline-none"
                    value={n.category}
                    onChange={(e) => db.worldNotes.update(n.id, { category: e.target.value as any })}
                  >
                    <option value="location">Location</option>
                    <option value="timeline">Timeline</option>
                    <option value="lore">Lore</option>
                    <option value="other">Other</option>
                  </select>
                  <button
                    onClick={() => db.worldNotes.delete(n.id)}
                    className="text-ink-soft/40 hover:text-rose"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <textarea
                  className="mt-2 w-full resize-none bg-transparent text-xs leading-relaxed outline-none placeholder:text-ink-soft/40"
                  placeholder="Details, notes, plot points..."
                  rows={4}
                  value={n.content}
                  onChange={(e) => db.worldNotes.update(n.id, { content: e.target.value })}
                />
              </div>
            ))}
            <button
              onClick={addNote}
              className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-[var(--border)] py-2 text-xs text-ink-soft/60 hover:bg-[var(--bg-dim)]"
            >
              <Plus size={13} /> Add note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
