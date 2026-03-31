import { useState, useRef, useCallback } from "react";
import { useWhiteboard } from "../hooks/useElements";
import { useImageInsert } from "../hooks/useImageInsert";
import { layoutMindMapTree } from "../utils/mindmapLayout";
import { ALL_FAVORITABLE, renderToolIcon } from "../constants/tools";
import type { ToolType } from "../types/elements";

const STORAGE_KEY = "floating-tools";
const DEFAULT_FAVORITES = ["pen", "eraser", "select", "undo", "redo"];

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Failed to load floating toolbar favorites:", e);
  }
  return DEFAULT_FAVORITES;
}

function saveFavorites(keys: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

interface FloatingToolbarProps {
  onContextMenu: (e: React.MouseEvent, toolKey: string) => void;
  favorites: string[];
}

export function FloatingToolbar({ onContextMenu, favorites }: FloatingToolbarProps) {
  const { state, dispatch, setTool } = useWhiteboard();
  const { handleFilePicker } = useImageInsert();

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const toolbar = toolbarRef.current;
      if (!toolbar) return;
      const rect = toolbar.getBoundingClientRect();
      const parentRect = toolbar.parentElement?.getBoundingClientRect();
      if (!parentRect) return;
      const currentX = rect.left - parentRect.left;
      const currentY = rect.top - parentRect.top;
      setIsDragging(true);
      dragOffset.current = { x: e.clientX - currentX, y: e.clientY - currentY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const handleDragMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      setPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    },
    [isDragging]
  );

  const handleDragEnd = useCallback(
    (e: React.PointerEvent) => {
      setIsDragging(false);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    },
    []
  );

  if (favorites.length === 0) return null;

  const favDefs = favorites
    .map((key) => ALL_FAVORITABLE.find((t) => t.key === key))
    .filter(Boolean) as typeof ALL_FAVORITABLE;

  const executeAction = (key: string) => {
    // Tool-type actions
    const toolKeys = ["select", "pen", "highlighter", "laser", "line", "rectangle", "ellipse", "arrow", "text", "eraser", "mindmap", "hand"];
    if (toolKeys.includes(key)) {
      setTool(key as ToolType);
      return;
    }
    switch (key) {
      case "image": handleFilePicker(); break;
      case "undo": dispatch({ type: "UNDO" }); break;
      case "redo": dispatch({ type: "REDO" }); break;
      case "clear": dispatch({ type: "CLEAR_ALL" }); break;
      case "layout": {
        const positions = layoutMindMapTree(state.elements);
        if (positions.size > 0) dispatch({ type: "LAYOUT_MINDMAP", positions });
        break;
      }
    }
  };

  const isActive = (key: string): boolean => {
    const toolKeys = ["select", "pen", "highlighter", "laser", "line", "rectangle", "ellipse", "arrow", "text", "eraser", "mindmap", "hand"];
    if (toolKeys.includes(key)) return state.activeTool === key;
    return false;
  };

  const isDisabled = (key: string): boolean => {
    if (key === "undo") return state.undoStack.length === 0;
    if (key === "redo") return state.redoStack.length === 0;
    if (key === "clear") return !state.elements.some((el) => !el.isDeleted);
    return false;
  };

  const posStyle = pos
    ? { left: pos.x, top: pos.y, bottom: "auto" as const }
    : { left: "50%", bottom: 24, transform: "translateX(-50%)" };

  return (
    <div
      ref={toolbarRef}
      className="floating-toolbar"
      style={{
        ...posStyle,
        cursor: isDragging ? "grabbing" : undefined,
      }}
    >
      {/* Drag handle */}
      <div
        className="floating-toolbar-handle"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        title="拖拽移动"
      >
        ⠿
      </div>

      {favDefs.map((def) => (
        <button
          key={def.key}
          className={`ft-btn ${isActive(def.key) ? "active" : ""}`}
          onClick={() => executeAction(def.key)}
          onContextMenu={(e) => {
            e.preventDefault();
            onContextMenu(e, def.key);
          }}
          disabled={isDisabled(def.key)}
          title={`${def.label}${def.shortcut ? ` (${def.shortcut})` : ""}`}
        >
          {renderToolIcon(def.icon, "ft-icon")}
          {def.shortcut && def.shortcut.length <= 2 && (
            <span className="shortcut-badge">{def.shortcut}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// Re-export helpers for use in App.tsx
export { loadFavorites, saveFavorites, DEFAULT_FAVORITES };
