"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { db, type Chapter, type Scene } from "@/lib/db";
import { newId } from "@/lib/utils";
import { GripVertical, Plus, ChevronDown, ChevronRight, FileText, Trash2 } from "lucide-react";

function SortableScene({
  scene,
  isActive,
  onSelectScene,
  onDelete,
}: {
  scene: Scene;
  isActive: boolean;
  onSelectScene: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: scene.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelectScene(scene.id)}
      className={`group/scene flex w-full cursor-pointer items-center gap-1 rounded-md px-1 py-1.5 text-left text-sm transition-colors ${
        isActive ? "bg-sepia/15 text-sepia font-medium" : "text-ink-soft hover:bg-[var(--bg-dim)]"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 cursor-grab text-ink-soft/30 opacity-0 hover:text-ink-soft group-hover/scene:opacity-100"
        title="Drag to reorder"
      >
        <GripVertical size={12} />
      </button>
      <FileText size={13} className="shrink-0" />
      <span className="flex-1 truncate">{scene.title}</span>
      <span className="shrink-0 text-xs opacity-50">{scene.wordCount}</span>
      <button
        onClick={(e) => onDelete(scene.id, e)}
        className="shrink-0 text-ink-soft/40 opacity-0 hover:text-rose group-hover/scene:opacity-100"
        title="Delete scene"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function SortableChapter({
  chapter,
  scenes,
  activeSceneId,
  onSelectScene,
  bookId,
}: {
  chapter: Chapter;
  scenes: Scene[];
  activeSceneId: string | null;
  onSelectScene: (id: string) => void;
  bookId: string;
}) {
  const [open, setOpen] = useState(true);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: chapter.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const sceneSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleSceneDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = scenes.findIndex((s) => s.id === active.id);
    const newIndex = scenes.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(scenes, oldIndex, newIndex);
    await Promise.all(reordered.map((s, i) => db.scenes.update(s.id, { order: i })));
  };

  const addScene = async () => {
    const count = await db.scenes.where("chapterId").equals(chapter.id).count();
    const id = newId();
    await db.scenes.add({
      id,
      chapterId: chapter.id,
      bookId,
      title: `Scene ${count + 1}`,
      content: "",
      order: count,
      wordCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    onSelectScene(id);
  };

  const deleteChapter = async () => {
    if (!confirm(`Delete "${chapter.title}" and all its scenes?`)) return;
    const sceneIds = scenes.map((s) => s.id);
    await db.scenes.bulkDelete(sceneIds);
    await db.chapters.delete(chapter.id);
  };

  const deleteScene = async (sceneId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (scenes.length <= 1) {
      if (!confirm("This is the last scene in the chapter. Delete it anyway?")) return;
    } else if (!confirm("Delete this scene? This cannot be undone.")) {
      return;
    }
    await db.scenes.delete(sceneId);
    await db.snapshots.where("sceneId").equals(sceneId).delete();
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-1">
      <div className="group flex items-center gap-1 rounded-md px-1 py-1.5 hover:bg-[var(--bg-dim)]">
        <button {...attributes} {...listeners} className="cursor-grab text-ink-soft/40 hover:text-ink-soft">
          <GripVertical size={14} />
        </button>
        <button onClick={() => setOpen(!open)} className="text-ink-soft">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <input
          className="min-w-0 flex-1 truncate bg-transparent text-sm font-medium outline-none"
          value={chapter.title}
          onChange={(e) => db.chapters.update(chapter.id, { title: e.target.value })}
        />
        <button
          onClick={addScene}
          className="shrink-0 text-ink-soft opacity-70 hover:text-sepia hover:opacity-100"
          title="Add scene"
        >
          <Plus size={14} />
        </button>
        <button
          onClick={deleteChapter}
          className="shrink-0 text-ink-soft opacity-70 hover:text-rose hover:opacity-100"
          title="Delete chapter"
        >
          <Trash2 size={13} />
        </button>
      </div>
      {open && (
        <div className="ml-6 border-l border-[var(--border)] pl-2">
          <DndContext sensors={sceneSensors} collisionDetection={closestCenter} onDragEnd={handleSceneDragEnd}>
            <SortableContext items={scenes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {scenes.map((scene) => (
                <SortableScene
                  key={scene.id}
                  scene={scene}
                  isActive={activeSceneId === scene.id}
                  onSelectScene={onSelectScene}
                  onDelete={deleteScene}
                />
              ))}
            </SortableContext>
          </DndContext>
          {scenes.length === 0 && (
            <button
              onClick={addScene}
              className="w-full rounded-md px-2 py-1.5 text-left text-xs text-ink-soft/60 hover:bg-[var(--bg-dim)]"
            >
              + add a scene
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  bookId,
  activeSceneId,
  onSelectScene,
}: {
  bookId: string;
  activeSceneId: string | null;
  onSelectScene: (id: string) => void;
}) {
  const chapters = useLiveQuery(
    () => db.chapters.where("bookId").equals(bookId).sortBy("order"),
    [bookId]
  ) ?? [];
  const allScenes = useLiveQuery(
    () => db.scenes.where("bookId").equals(bookId).sortBy("order"),
    [bookId]
  ) ?? [];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const addChapter = async () => {
    const id = newId();
    await db.chapters.add({
      id,
      bookId,
      title: `Chapter ${chapters.length + 1}`,
      order: chapters.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = chapters.findIndex((c) => c.id === active.id);
    const newIndex = chapters.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(chapters, oldIndex, newIndex);
    await Promise.all(reordered.map((c, i) => db.chapters.update(c.id, { order: i })));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft/70">
          Manuscript
        </span>
        <button onClick={addChapter} className="text-ink-soft hover:text-sepia" title="Add chapter">
          <Plus size={15} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={chapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {chapters.map((chapter) => (
              <SortableChapter
                key={chapter.id}
                chapter={chapter}
                scenes={allScenes.filter((s) => s.chapterId === chapter.id)}
                activeSceneId={activeSceneId}
                onSelectScene={onSelectScene}
                bookId={bookId}
              />
            ))}
          </SortableContext>
        </DndContext>
        {chapters.length === 0 && (
          <button
            onClick={addChapter}
            className="mt-2 w-full rounded-md border border-dashed border-[var(--border)] px-3 py-3 text-sm text-ink-soft/60 hover:bg-[var(--bg-dim)]"
          >
            + Start your first chapter
          </button>
        )}
      </div>
    </div>
  );
}