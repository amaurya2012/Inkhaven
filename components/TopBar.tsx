"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useUIStore, type Theme } from "@/store/useUIStore";
import { db, type Book } from "@/lib/db";
import { exportToDocx, exportToPdf } from "@/lib/export";
import { startAmbientRain, stopAmbientRain, type AmbientPreset } from "@/lib/ambientSound";
import {
  ArrowLeft,
  PanelLeft,
  PanelRight,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Coffee,
  Download,
  Loader2,
  Check,
  Pilcrow,
  Volume2,
  VolumeX,
  ChevronDown,
  CloudRain,
  Waves,
  Minus,
  Plus,
} from "lucide-react";

const SOUND_LABEL: Record<AmbientPreset, string> = {
  rain: "Rain",
  waves: "Ocean waves",
  cafe: "Cafe hum",
};

const SOUND_ICON: Record<AmbientPreset, React.ReactNode> = {
  rain: <CloudRain size={13} />,
  waves: <Waves size={13} />,
  cafe: <Coffee size={13} />,
};

export default function TopBar({ book }: { book: Book }) {
  const {
    theme,
    setTheme,
    focusMode,
    toggleFocusMode,
    toggleLeftPanel,
    toggleRightPanel,
    toolbarOpen,
    toggleToolbar,
    ambientSound,
    toggleAmbientSound,
    ambientPreset,
    setAmbientPreset,
    pdfFontSize,
    setPdfFontSize,
    flushSave,
    saveStatus,
  } = useUIStore();
  const [exportOpen, setExportOpen] = useState(false);
  const [soundMenuOpen, setSoundMenuOpen] = useState(false);

  useEffect(() => {
    if (ambientSound) {
      startAmbientRain(ambientPreset);
    } else {
      stopAmbientRain();
    }
    return () => stopAmbientRain();
  }, [ambientSound, ambientPreset]);

  const totalWords =
    useLiveQuery(async () => {
      const scenes = await db.scenes.where("bookId").equals(book.id).toArray();
      return scenes.reduce((sum, s) => sum + s.wordCount, 0);
    }, [book.id]) ?? 0;

  const progress = book.targetWordCount
    ? Math.min(100, Math.round((totalWords / book.targetWordCount) * 100))
    : 0;

  const themeIcon: Record<Theme, React.ReactNode> = {
    light: <Sun size={15} />,
    dark: <Moon size={15} />,
    sepia: <Coffee size={15} />,
  };

  if (focusMode) {
    return (
      <div className="fixed right-4 top-4 z-20 flex items-center gap-2">
        <button
          onClick={toggleAmbientSound}
          className={`rounded-full bg-[var(--bg-dim)] p-2 opacity-40 transition-opacity hover:opacity-100 ${
            ambientSound ? "text-sepia opacity-100" : "text-ink-soft"
          }`}
          title={ambientSound ? `Turn off ${SOUND_LABEL[ambientPreset].toLowerCase()}` : `Play ${SOUND_LABEL[ambientPreset].toLowerCase()}`}
        >
          {ambientSound ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>
        <button
          onClick={toggleFocusMode}
          className="rounded-full bg-[var(--bg-dim)] p-2 text-ink-soft opacity-40 transition-opacity hover:opacity-100"
          title="Exit focus mode"
        >
          <Minimize2 size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-14 items-center justify-between border-b border-[var(--border)] px-4">
      <div className="flex items-center gap-2">
        <Link href="/" className="text-ink-soft hover:text-sepia">
          <ArrowLeft size={17} />
        </Link>
        <button onClick={toggleLeftPanel} className="text-ink-soft hover:text-sepia" title="Toggle manuscript panel">
          <PanelLeft size={16} />
        </button>
        <div className="ml-2">
          <div className="text-sm font-semibold leading-tight">{book.title}</div>
          <div className="text-xs text-ink-soft/60">
            {totalWords.toLocaleString("en-IN")} words
            {book.targetWordCount ? ` · ${progress}% of goal` : ""}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-xs text-ink-soft/60">
          {saveStatus === "saving" && (
            <>
              <Loader2 size={12} className="animate-spin" /> Saving...
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check size={12} /> Saved
            </>
          )}
          {saveStatus === "unsaved" && <>Editing...</>}
        </div>

        <div className="flex items-center rounded-full border border-[var(--border)] p-0.5">
          {(["light", "sepia", "dark"] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`rounded-full p-1.5 ${theme === t ? "bg-sepia text-paper" : "text-ink-soft hover:bg-[var(--bg-dim)]"}`}
              title={t}
            >
              {themeIcon[t]}
            </button>
          ))}
        </div>

        <button onClick={toggleFocusMode} className="text-ink-soft hover:text-sepia" title="Focus mode">
          <Maximize2 size={16} />
        </button>

        <button onClick={toggleRightPanel} className="text-ink-soft hover:text-sepia" title="Toggle notes panel">
          <PanelRight size={16} />
        </button>

        <div className="relative flex items-center">
          <button
            onClick={toggleAmbientSound}
            className={ambientSound ? "text-sepia" : "text-ink-soft hover:text-sepia"}
            title={ambientSound ? "Turn off ambient sound" : "Play ambient sound"}
          >
            {ambientSound ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            onClick={() => setSoundMenuOpen((v) => !v)}
            className="text-ink-soft hover:text-sepia"
            title="Choose sound"
          >
            <ChevronDown size={12} />
          </button>
          {soundMenuOpen && (
            <div className="absolute right-0 top-7 z-10 w-36 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg)] py-1 shadow-lg">
              {(Object.keys(SOUND_LABEL) as AmbientPreset[]).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setAmbientPreset(p);
                    if (!ambientSound) toggleAmbientSound();
                    setSoundMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 border-b border-[var(--border)] px-3 py-2 text-left text-xs last:border-b-0 hover:bg-[var(--bg-dim)] hover:text-sepia ${
                    ambientSound && ambientPreset === p ? "text-sepia" : "text-ink"
                  }`}
                >
                  {SOUND_ICON[p]} {SOUND_LABEL[p]}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={toggleToolbar}
          className={toolbarOpen ? "text-sepia" : "text-ink-soft hover:text-sepia"}
          title={toolbarOpen ? "Hide formatting toolbar" : "Show formatting toolbar"}
        >
          <Pilcrow size={16} />
        </button>

        <div className="relative">
          <button
            onClick={() => setExportOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-md bg-sepia px-3 py-1.5 text-xs font-medium text-paper hover:bg-sepia/90"
          >
            <Download size={13} /> Export
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-9 z-10 w-44 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg)] py-1 shadow-lg">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
                <span className="text-xs text-ink-soft">PDF font size</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPdfFontSize(pdfFontSize - 1)}
                    className="flex h-5 w-5 items-center justify-center rounded text-ink-soft hover:bg-[var(--bg-dim)] hover:text-sepia"
                  >
                    <Minus size={11} />
                  </button>
                  <span className="w-5 text-center text-xs text-ink">{pdfFontSize}</span>
                  <button
                    onClick={() => setPdfFontSize(pdfFontSize + 1)}
                    className="flex h-5 w-5 items-center justify-center rounded text-ink-soft hover:bg-[var(--bg-dim)] hover:text-sepia"
                  >
                    <Plus size={11} />
                  </button>
                </div>
              </div>
              <button
                onClick={async () => {
                  if (flushSave) await flushSave();
                  void exportToDocx(book.id);
                  setExportOpen(false);
                }}
                className="block w-full border-b border-[var(--border)] px-3 py-2 text-left text-xs text-ink hover:bg-[var(--bg-dim)] hover:text-sepia"
              >
                Export as .docx
              </button>
              <button
                onClick={async () => {
                  if (flushSave) await flushSave();
                  void exportToPdf(book.id, pdfFontSize);
                  setExportOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-xs text-ink hover:bg-[var(--bg-dim)] hover:text-sepia"
              >
                Export as .pdf
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}