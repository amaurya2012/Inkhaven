import { create } from "zustand";
import type { AmbientPreset } from "@/lib/ambientSound";

export type Theme = "light" | "dark" | "sepia";

interface UIState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  focusMode: boolean;
  toggleFocusMode: () => void;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toolbarOpen: boolean;
  toggleToolbar: () => void;
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
  editorFontSize: number;
  setEditorFontSize: (n: number) => void;
  editorLineHeight: number;
  setEditorLineHeight: (n: number) => void;
  ambientSound: boolean;
  toggleAmbientSound: () => void;
  ambientPreset: AmbientPreset;
  setAmbientPreset: (p: AmbientPreset) => void;
  saveStatus: "saved" | "saving" | "unsaved";
  setSaveStatus: (s: "saved" | "saving" | "unsaved") => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: "light",
  setTheme: (t) => set({ theme: t }),
  focusMode: false,
  toggleFocusMode: () =>
    set((s) => ({
      focusMode: !s.focusMode,
      leftPanelOpen: s.focusMode,
      rightPanelOpen: s.focusMode,
    })),
  leftPanelOpen: true,
  rightPanelOpen: false,
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  toolbarOpen: true,
  toggleToolbar: () => set((s) => ({ toolbarOpen: !s.toolbarOpen })),
  sidebarWidth: 288,
  setSidebarWidth: (w) => set({ sidebarWidth: Math.min(420, Math.max(200, w)) }),
  editorFontSize: 18.4, // ~1.15rem
  setEditorFontSize: (n) => set({ editorFontSize: Math.min(26, Math.max(14, n)) }),
  editorLineHeight: 1.85,
  setEditorLineHeight: (n) => set({ editorLineHeight: Math.min(2.4, Math.max(1.3, Math.round(n * 100) / 100)) }),
  ambientSound: false,
  toggleAmbientSound: () => set((s) => ({ ambientSound: !s.ambientSound })),
  ambientPreset: "rain",
  setAmbientPreset: (p) => set({ ambientPreset: p }),
  saveStatus: "saved",
  setSaveStatus: (s) => set({ saveStatus: s }),
}));