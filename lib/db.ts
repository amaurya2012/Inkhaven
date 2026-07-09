import Dexie, { type Table } from "dexie";

export interface Book {
  id: string;
  title: string;
  author: string;
  genre?: string;
  targetWordCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface Chapter {
  id: string;
  bookId: string;
  title: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface Scene {
  id: string;
  chapterId: string;
  bookId: string;
  title: string;
  content: string; // TipTap JSON stringified
  order: number;
  wordCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface Character {
  id: string;
  bookId: string;
  name: string;
  role?: string;
  description: string;
  traits: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorldNote {
  id: string;
  bookId: string;
  title: string;
  content: string;
  category: "location" | "timeline" | "lore" | "other";
  createdAt: number;
  updatedAt: number;
}

export interface Snapshot {
  id: string;
  sceneId: string;
  content: string;
  wordCount: number;
  createdAt: number;
  label?: string;
}

export interface WritingSession {
  id: string;
  bookId: string;
  date: string; // YYYY-MM-DD
  wordsWritten: number;
}

class InkhavenDB extends Dexie {
  books!: Table<Book, string>;
  chapters!: Table<Chapter, string>;
  scenes!: Table<Scene, string>;
  characters!: Table<Character, string>;
  worldNotes!: Table<WorldNote, string>;
  snapshots!: Table<Snapshot, string>;
  sessions!: Table<WritingSession, string>;

  constructor() {
    super("inkhaven");
    this.version(1).stores({
      books: "id, title, updatedAt",
      chapters: "id, bookId, order",
      scenes: "id, chapterId, bookId, order",
      characters: "id, bookId",
      worldNotes: "id, bookId, category",
      snapshots: "id, sceneId, createdAt",
      sessions: "id, bookId, date, [bookId+date]",
    });
  }
}

export const db = new InkhavenDB();
