"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import { useEffect, useRef, useCallback } from "react";
import { db, type Scene } from "@/lib/db";
import { countWords, newId, todayStr } from "@/lib/utils";
import { useUIStore } from "@/store/useUIStore";
import {
  Bold,
  Italic,
  Strikethrough,
  UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  LinkIcon,
  Minus,
  Undo2,
  Redo2,
} from "lucide-react";

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded-md p-1.5 transition-colors ${
        active ? "bg-sepia text-paper" : "text-ink-soft hover:bg-[var(--bg-dim)]"
      }`}
    >
      {children}
    </button>
  );
}

export default function Editor({ scene }: { scene: Scene }) {
  const setSaveStatus = useUIStore((s) => s.setSaveStatus);
  const focusMode = useUIStore((s) => s.focusMode);
  const toolbarOpen = useUIStore((s) => s.toolbarOpen);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedWordCount = useRef(scene.wordCount);
  const snapshotTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Begin where the silence ends...",
      }),
      Typography,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: scene.content ? JSON.parse(scene.content) : "",
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[60vh]",
      },
    },
    onUpdate: ({ editor }) => {
      setSaveStatus("unsaved");
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        void persist(editor.getJSON(), editor.getText());
      }, 1200);
    },
    immediatelyRender: false,
  });

  const persist = useCallback(
    async (json: object, text: string) => {
      setSaveStatus("saving");
      const wordCount = countWords(text);
      const now = Date.now();
      await db.scenes.update(scene.id, {
        content: JSON.stringify(json),
        wordCount,
        updatedAt: now,
      });

      const delta = wordCount - lastSavedWordCount.current;
      if (delta !== 0) {
        const date = todayStr();
        const existing = await db.sessions
          .where("[bookId+date]")
          .equals([scene.bookId, date])
          .first();
        if (existing) {
          await db.sessions.update(existing.id, {
            wordsWritten: Math.max(0, existing.wordsWritten + delta),
          });
        } else {
          await db.sessions.add({
            id: newId(),
            bookId: scene.bookId,
            date,
            wordsWritten: Math.max(0, delta),
          });
        }
        lastSavedWordCount.current = wordCount;
      }
      setSaveStatus("saved");
    },
    [scene.id, scene.bookId, setSaveStatus]
  );

  // load new scene content when switching scenes
  useEffect(() => {
    if (!editor) return;
    const content = scene.content ? JSON.parse(scene.content) : "";
    editor.commands.setContent(content);
    lastSavedWordCount.current = scene.wordCount;
  }, [scene.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // periodic version snapshot every 3 minutes while editing
  useEffect(() => {
    snapshotTimer.current = setInterval(async () => {
      if (!editor) return;
      const text = editor.getText();
      if (!text.trim()) return;
      await db.snapshots.add({
        id: newId(),
        sceneId: scene.id,
        content: JSON.stringify(editor.getJSON()),
        wordCount: countWords(text),
        createdAt: Date.now(),
      });
      const all = await db.snapshots.where("sceneId").equals(scene.id).toArray();
      if (all.length > 30) {
        const sorted = all.sort((a, b) => a.createdAt - b.createdAt);
        const toDelete = sorted.slice(0, all.length - 30);
        await db.snapshots.bulkDelete(toDelete.map((s) => s.id));
      }
    }, 180000);
    return () => {
      if (snapshotTimer.current) clearInterval(snapshotTimer.current);
    };
  }, [scene.id, editor]);

  return (
    <div className={focusMode ? "typewriter-mode" : ""}>
      {!focusMode && toolbarOpen && editor && (
        <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur">
          <div className="flex flex-wrap items-center gap-0.5 px-4 py-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Bold (Ctrl+B)"
          >
            <Bold size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Italic (Ctrl+I)"
          >
            <Italic size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
            title="Strikethrough"
          >
            <Strikethrough size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon size={15} />
          </ToolbarButton>

          <div className="mx-1 h-4 w-px bg-[var(--border)]" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive("heading", { level: 1 })}
            title="Heading 1"
          >
            <Heading1 size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
          >
            <Heading2 size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
            title="Heading 3"
          >
            <Heading3 size={15} />
          </ToolbarButton>

          <div className="mx-1 h-4 w-px bg-[var(--border)]" />

          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            title="Align left"
          >
            <AlignLeft size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            active={editor.isActive({ textAlign: "center" })}
            title="Align center"
          >
            <AlignCenter size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            active={editor.isActive({ textAlign: "right" })}
            title="Align right"
          >
            <AlignRight size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
            active={editor.isActive({ textAlign: "justify" })}
            title="Justify"
          >
            <AlignJustify size={15} />
          </ToolbarButton>

          <div className="mx-1 h-4 w-px bg-[var(--border)]" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Bullet list"
          >
            <List size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Numbered list"
          >
            <ListOrdered size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            title="Quote"
          >
            <Quote size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {
              const url = window.prompt("Link URL");
              if (url === null) return;
              if (url === "") {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                return;
              }
              editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
            }}
            active={editor.isActive("link")}
            title="Add link"
          >
            <LinkIcon size={15} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Horizontal rule"
          >
            <Minus size={15} />
          </ToolbarButton>

          <div className="mx-1 h-4 w-px bg-[var(--border)]" />

          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)">
            <Undo2 size={15} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Shift+Z)">
            <Redo2 size={15} />
          </ToolbarButton>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-[680px] px-6 py-10">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}