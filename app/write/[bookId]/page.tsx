"use client";

import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { useUIStore } from "@/store/useUIStore";
import Sidebar from "@/components/Sidebar";
import Editor from "@/components/Editor";
import NotesPanel from "@/components/NotesPanel";
import TopBar from "@/components/TopBar";
import { Feather } from "lucide-react";

export default function WritePage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.bookId as string;
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);
  const { leftPanelOpen, rightPanelOpen, focusMode, sidebarWidth, setSidebarWidth } = useUIStore();

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => setSidebarWidth(e.clientX);
    const onUp = () => setResizing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing, setSidebarWidth]);

  const book = useLiveQuery(() => db.books.get(bookId), [bookId]);
  const scene = useLiveQuery(
    () => (activeSceneId ? db.scenes.get(activeSceneId) : undefined),
    [activeSceneId]
  );
  const firstScene = useLiveQuery(async () => {
    const chapters = await db.chapters.where("bookId").equals(bookId).sortBy("order");
    for (const ch of chapters) {
      const s = await db.scenes.where("chapterId").equals(ch.id).sortBy("order");
      if (s.length) return s[0];
    }
    return undefined;
  }, [bookId]);

  useEffect(() => {
    if (!activeSceneId && firstScene) setActiveSceneId(firstScene.id);
  }, [firstScene, activeSceneId]);

  if (book === undefined) {
    return <div className="flex h-screen items-center justify-center text-ink-soft">Loading your desk...</div>;
  }

  if (book === null || !book) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-ink-soft">
        <p>This book couldn&apos;t be found.</p>
        <button onClick={() => router.push("/")} className="text-sepia underline">
          Back to library
        </button>
      </div>
    );
  }

  return (
    <div className={`flex h-screen flex-col ${resizing ? "cursor-col-resize select-none" : ""}`}>
      <TopBar book={book} />
      <div className="flex flex-1 overflow-hidden">
        {!focusMode && leftPanelOpen && (
          <>
            <div style={{ width: sidebarWidth }} className="shrink-0 border-r border-[var(--border)]">
              <Sidebar bookId={bookId} activeSceneId={activeSceneId} onSelectScene={setActiveSceneId} />
            </div>
            <div
              onMouseDown={() => setResizing(true)}
              className={`w-1 shrink-0 cursor-col-resize transition-colors hover:bg-sepia/40 ${
                resizing ? "bg-sepia/50" : ""
              }`}
              title="Drag to resize"
            />
          </>
        )}

        <div className="flex-1 overflow-y-auto">
          {scene ? (
            <Editor key={scene.id} scene={scene} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-soft/60">
              <Feather size={32} />
              <p className="text-sm">Choose or create a scene to begin writing.</p>
            </div>
          )}
        </div>

        {!focusMode && rightPanelOpen && (
          <div className="w-72 shrink-0 border-l border-[var(--border)]">
            <NotesPanel bookId={bookId} />
          </div>
        )}
      </div>
    </div>
  );
}