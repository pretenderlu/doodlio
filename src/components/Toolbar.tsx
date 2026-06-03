import { useState, memo } from "react";
import { useWhiteboard } from "../hooks/useElements";
import { useImageInsert } from "../hooks/useImageInsert";
import { layoutMindMapTree } from "../utils/mindmapLayout";
import { TOOLS, renderToolIcon, toolLabelKey } from "../constants/tools";
import type { ToolType, MindMapLayoutDirection } from "../types/elements";
import { useI18n } from "../i18n";

interface ToolbarProps {
  onContextMenu: (e: React.MouseEvent, toolKey: string) => void;
}

export const Toolbar = memo(function Toolbar({ onContextMenu }: ToolbarProps) {
  const { t } = useI18n();
  const { state, dispatch, setTool } = useWhiteboard();
  const { handleFilePicker } = useImageInsert();
  const hasVisibleElements = state.elements.some((el) => !el.isDeleted);
  const [layoutDirection, setLayoutDirection] = useState<MindMapLayoutDirection>("right");

  const handleToolContext = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    onContextMenu(e, key);
  };

  return (
    <div className="toolbar">
      {/* Tools */}
      <div className="toolbar-group">
        {TOOLS.map((tool) => (
          <button
            key={tool.key}
            className={`tool-btn ${state.activeTool === tool.key ? "active" : ""}`}
            onClick={() => setTool(tool.key as ToolType)}
            onContextMenu={(e) => handleToolContext(e, tool.key)}
            data-tooltip={`${t(toolLabelKey(tool.key))}${tool.shortcut ? ` (${tool.shortcut})` : ""}`}
          >
            {renderToolIcon(tool.icon, "tool-icon")}
            {tool.shortcut && tool.shortcut.length <= 2 && (
              <span className="shortcut-badge">{tool.shortcut}</span>
            )}
          </button>
        ))}
      </div>

      {/* Mind map layout button + direction */}
      {state.activeTool === "mindmap" && (
        <>
          <div className="toolbar-divider" />
          <div className="toolbar-group">
            <button
              className={`tool-btn mini ${layoutDirection === "right" ? "active" : ""}`}
              onClick={(e) => { e.stopPropagation(); setLayoutDirection("right"); }}
              data-tooltip={t("toolbar.layout.horizontal")}
            >→</button>
            <button
              className={`tool-btn mini ${layoutDirection === "down" ? "active" : ""}`}
              onClick={(e) => { e.stopPropagation(); setLayoutDirection("down"); }}
              data-tooltip={t("toolbar.layout.vertical")}
            >↓</button>
            <button
              className={`tool-btn mini ${layoutDirection === "radial" ? "active" : ""}`}
              onClick={(e) => { e.stopPropagation(); setLayoutDirection("radial"); }}
              data-tooltip={t("toolbar.layout.radial")}
            >◎</button>
            <button
              className="tool-btn"
              onClick={(e) => {
                e.stopPropagation();
                const positions = layoutMindMapTree(state.elements, layoutDirection);
                if (positions.size > 0) {
                  dispatch({ type: "LAYOUT_MINDMAP", positions });
                }
              }}
              data-tooltip={t("tool.layout")}
            >
              {renderToolIcon("layout", "tool-icon")}
            </button>
          </div>
        </>
      )}

      <div className="toolbar-divider" />

      {/* Actions */}
      <div className="toolbar-group">
        <button
          className="tool-btn"
          onClick={(e) => { e.stopPropagation(); handleFilePicker(); }}
          onContextMenu={(e) => handleToolContext(e, "image")}
          data-tooltip={t("tool.image")}
        >
          {renderToolIcon("image", "tool-icon")}
        </button>
        <button
          className="tool-btn"
          onClick={(e) => { e.stopPropagation(); dispatch({ type: "UNDO" }); }}
          onContextMenu={(e) => handleToolContext(e, "undo")}
          disabled={state.undoStack.length === 0}
          data-tooltip={`${t("tool.undo")} (Ctrl+Z)`}
        >
          {renderToolIcon("undo", "tool-icon")}
        </button>
        <button
          className="tool-btn"
          onClick={(e) => { e.stopPropagation(); dispatch({ type: "REDO" }); }}
          onContextMenu={(e) => handleToolContext(e, "redo")}
          disabled={state.redoStack.length === 0}
          data-tooltip={`${t("tool.redo")} (Ctrl+Shift+Z)`}
        >
          {renderToolIcon("redo", "tool-icon")}
        </button>
        <button
          className="tool-btn"
          onClick={(e) => { e.stopPropagation(); hasVisibleElements && dispatch({ type: "CLEAR_ALL" }); }}
          onContextMenu={(e) => handleToolContext(e, "clear")}
          disabled={!hasVisibleElements}
          data-tooltip={t("tool.clear")}
        >
          {renderToolIcon("clear", "tool-icon")}
        </button>
      </div>
    </div>
  );
});
