# Inkhaven

A distraction-free, offline-first writing desk for your novel. Built local-first with IndexedDB — your manuscript lives on your device, not on someone else's server.

## Features

- **Book → Chapter → Scene** hierarchy with drag-and-drop reordering
- **Distraction-free editor** (TipTap) with auto-save every ~1.2s
- **Focus/typewriter mode** — hides UI chrome, centers the current line
- **Character & world-building notes** panel
- **Word count & streak tracking** — daily writing heatmap, per-book progress toward a target word count
- **Version history** — automatic timestamped snapshots every 3 minutes (last 30 kept per scene)
- **Export** to `.docx` and `.pdf` in a formatted manuscript style
- **Light / sepia / dark** themes
- **Installable PWA** — works offline, "Add to Home Screen" on mobile and desktop

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> Note: the editor and title fonts (Fraunces, Source Serif 4, Inter) load from Google Fonts at build time, so you'll need an internet connection the first time you run `npm run dev` or `npm run build`.

## Tech stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- TipTap (rich text editor)
- Dexie.js (IndexedDB — local-first storage)
- next-pwa (offline support, installability)
- docx + jsPDF (manuscript export)
- dnd-kit (drag-and-drop reordering)
- Zustand (UI state)

## Project structure

```
app/
  page.tsx                 dashboard — your library of books
  write/[bookId]/page.tsx  the writing screen
  offline/page.tsx         shown when offline with no cache
components/
  Editor.tsx        TipTap editor + autosave + snapshotting
  Sidebar.tsx        chapter/scene tree, drag-and-drop
  TopBar.tsx         theme switcher, save status, export menu
  NotesPanel.tsx     characters + world-building notes
  Heatmap.tsx        writing streak calendar
lib/
  db.ts       Dexie schema (books, chapters, scenes, characters, worldNotes, snapshots, sessions)
  export.ts   .docx / .pdf export
  utils.ts    word counting, id generation, date helpers
store/
  useUIStore.ts   theme, focus mode, panel visibility, save status
```

## Known gaps / next steps

- Ambient sound toggle exists in the UI store (`ambientSound`) but isn't wired up to an actual sound or button yet.
- PWA icons are a placeholder monogram — swap `public/icons/*.png` for your own artwork before shipping.

## Deploying

Deploys cleanly to [Vercel](https://vercel.com/new) like any Next.js app — no environment variables needed since everything is stored locally in the browser.
