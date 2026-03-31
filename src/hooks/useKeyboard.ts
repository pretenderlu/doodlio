import { useEffect } from "react";
import { nanoid } from "nanoid";
import { useWhiteboard } from "./useElements";
import { getAutoColor } from "../utils/mindmapRenderer";
import { getNodeDepth, getMindMapCascadeDeleteIds } from "../utils/mindmapHelpers";
import { DEFAULT_STYLE } from "../types/elements";
import type {
  ToolType,
  WhiteboardElement,
  ImageElement,
  MindMapNodeElement,
  MindMapEdgeElement,
} from "../types/elements";

// Module-level clipboard for copy/paste
let clipboard: WhiteboardElement[] = [];

const TOOL_SHORTCUTS: Record<string, ToolType> = {
  v: "select",
  "1": "select",
  p: "pen",
  "2": "pen",
  l: "line",
  "3": "line",
  r: "rectangle",
  "4": "rectangle",
  o: "ellipse",
  "5": "ellipse",
  a: "arrow",
  "6": "arrow",
  t: "text",
  "7": "text",
  e: "eraser",
  "8": "eraser",
  h: "highlighter",
  g: "laser",
  m: "mindmap",
  "9": "mindmap",
};

export function useKeyboard() {
  const { state, dispatch, setTool } = useWhiteboard();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip when user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl+A — select all visible elements
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        const visibleIds = state.elements
          .filter((el) => !el.isDeleted)
          .map((el) => el.id);
        dispatch({ type: "SET_SELECTED", ids: visibleIds });
        if (state.activeTool !== "select") {
          setTool("select");
        }
        return;
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          dispatch({ type: "REDO" });
        } else {
          dispatch({ type: "UNDO" });
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        dispatch({ type: "REDO" });
        return;
      }

      // Copy (Ctrl+C)
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && !e.shiftKey) {
        if (state.selectedElementIds.length > 0) {
          e.preventDefault();
          clipboard = state.elements
            .filter((el) => state.selectedElementIds.includes(el.id) && !el.isDeleted)
            .map((el) => ({ ...el, _roughDrawable: undefined }));
        }
        return;
      }

      // Paste (Ctrl+V)
      if ((e.ctrlKey || e.metaKey) && e.key === "v" && !e.shiftKey) {
        if (clipboard.length > 0) {
          e.preventDefault();
          const maxZ = state.elements.reduce((max, el) => (el.isDeleted ? max : Math.max(max, el.zIndex)), 0);
          const pasted = clipboard.map((el, i) => ({
            ...el,
            id: nanoid(),
            x: el.x + 20,
            y: el.y + 20,
            zIndex: maxZ + 1 + i,
            groupId: undefined,
            _roughDrawable: undefined,
          } as WhiteboardElement));
          dispatch({ type: "PASTE_ELEMENTS", elements: pasted });
          // Update clipboard positions for subsequent pastes
          clipboard = pasted.map((el) => ({ ...el, _roughDrawable: undefined }));
        }
        return;
      }

      // Duplicate (Ctrl+D)
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        if (state.selectedElementIds.length > 0) {
          e.preventDefault();
          const maxZ = state.elements.reduce((max, el) => (el.isDeleted ? max : Math.max(max, el.zIndex)), 0);
          const toDup = state.elements
            .filter((el) => state.selectedElementIds.includes(el.id) && !el.isDeleted);
          const duped = toDup.map((el, i) => ({
            ...el,
            id: nanoid(),
            x: el.x + 20,
            y: el.y + 20,
            zIndex: maxZ + 1 + i,
            groupId: undefined,
            _roughDrawable: undefined,
          } as WhiteboardElement));
          dispatch({ type: "PASTE_ELEMENTS", elements: duped });
        }
        return;
      }

      // Group (Ctrl+G)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "g") {
        if (state.selectedElementIds.length >= 2) {
          e.preventDefault();
          dispatch({ type: "GROUP_ELEMENTS", ids: state.selectedElementIds });
        }
        return;
      }

      // Ungroup (Ctrl+Shift+G)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "g") {
        if (state.selectedElementIds.length === 1) {
          e.preventDefault();
          const sel = state.elements.find((el) => el.id === state.selectedElementIds[0]);
          if (sel?.type === "group") {
            dispatch({ type: "UNGROUP_ELEMENTS", groupId: sel.id });
          }
        }
        return;
      }

      // File operations (Ctrl+O, Ctrl+S, Ctrl+Shift+E, Ctrl+Shift+S)
      if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("wb:open-file"));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "s") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("wb:save-file"));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("wb:export-image"));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("wb:export-svg"));
        return;
      }

      // Help (?)
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("wb:toggle-help"));
        return;
      }

      // Slide navigation (PageDown/PageUp)
      if (e.key === "PageDown" || (e.key === "ArrowRight" && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        // ArrowRight only for slides when no element is selected (avoid conflict)
        if (e.key === "ArrowRight" && state.selectedElementIds.length > 0) {
          // skip — allow normal arrow key behavior
        } else {
          window.dispatchEvent(new CustomEvent("wb:slide-next"));
          // Don't preventDefault for ArrowRight to allow other uses
          if (e.key === "PageDown") e.preventDefault();
          return;
        }
      }
      if (e.key === "PageUp" || (e.key === "ArrowLeft" && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        if (e.key === "ArrowLeft" && state.selectedElementIds.length > 0) {
          // skip
        } else {
          window.dispatchEvent(new CustomEvent("wb:slide-prev"));
          if (e.key === "PageUp") e.preventDefault();
          return;
        }
      }

      const selectedId = state.selectedElementIds.length === 1 ? state.selectedElementIds[0] : null;

      // ---- Mind map specific shortcuts ----
      if (state.activeTool === "mindmap" && selectedId) {
        const selectedNode = state.elements.find(
          (el) => el.id === selectedId && el.type === "mindmap-node" && !el.isDeleted
        ) as MindMapNodeElement | undefined;

        if (selectedNode) {
          // Tab → create child node
          if (e.key === "Tab") {
            e.preventDefault();
            const maxZ = state.elements.reduce(
              (max, el) => (el.isDeleted ? max : Math.max(max, el.zIndex)), 0
            ) + 1;
            const siblings = state.elements.filter(
              (el) => el.type === "mindmap-node" && !el.isDeleted && el.parentId === selectedNode.id
            );
            const depth = getNodeDepth(selectedNode.id, state.elements) + 1;
            const nodeColor = getAutoColor(depth, siblings.length);

            const childId = nanoid();
            const child: MindMapNodeElement = {
              id: childId,
              type: "mindmap-node",
              x: selectedNode.x + 250,
              y: selectedNode.y + siblings.length * 50,
              width: 0, height: 0,
              style: { ...DEFAULT_STYLE },
              roughSeed: 0,
              isDeleted: false,
              zIndex: maxZ,
              textContent: "",
              fontSize: 16,
              fontFamily: "sans-serif",
              fontColor: "#333",
              nodeColor,
              parentId: selectedNode.id,
              collapsed: false,
            };
            dispatch({ type: "ADD_ELEMENT", element: child });

            const edge: MindMapEdgeElement = {
              id: nanoid(),
              type: "mindmap-edge",
              x: 0, y: 0, width: 0, height: 0,
              style: { ...DEFAULT_STYLE },
              roughSeed: 0,
              isDeleted: false,
              zIndex: maxZ - 1,
              fromNodeId: selectedNode.id,
              toNodeId: childId,
            };
            dispatch({ type: "ADD_ELEMENT", element: edge });
            dispatch({ type: "SET_SELECTED", ids: [childId] });
            return;
          }

          // Enter → create sibling node
          if (e.key === "Enter") {
            e.preventDefault();
            if (!selectedNode.parentId) return;

            const maxZ = state.elements.reduce(
              (max, el) => (el.isDeleted ? max : Math.max(max, el.zIndex)), 0
            ) + 1;
            const parentId = selectedNode.parentId;
            const siblings = state.elements.filter(
              (el) => el.type === "mindmap-node" && !el.isDeleted && el.parentId === parentId
            );
            const depth = getNodeDepth(parentId, state.elements) + 1;
            const nodeColor = getAutoColor(depth, siblings.length);

            const siblingId = nanoid();
            const sibling: MindMapNodeElement = {
              id: siblingId,
              type: "mindmap-node",
              x: selectedNode.x,
              y: selectedNode.y + 50,
              width: 0, height: 0,
              style: { ...DEFAULT_STYLE },
              roughSeed: 0,
              isDeleted: false,
              zIndex: maxZ,
              textContent: "",
              fontSize: 16,
              fontFamily: "sans-serif",
              fontColor: "#333",
              nodeColor,
              parentId,
              collapsed: false,
            };
            dispatch({ type: "ADD_ELEMENT", element: sibling });

            const edge: MindMapEdgeElement = {
              id: nanoid(),
              type: "mindmap-edge",
              x: 0, y: 0, width: 0, height: 0,
              style: { ...DEFAULT_STYLE },
              roughSeed: 0,
              isDeleted: false,
              zIndex: maxZ - 1,
              fromNodeId: parentId,
              toNodeId: siblingId,
            };
            dispatch({ type: "ADD_ELEMENT", element: edge });
            dispatch({ type: "SET_SELECTED", ids: [siblingId] });
            return;
          }

          // Space → toggle collapse
          if (e.key === " ") {
            e.preventDefault();
            dispatch({
              type: "UPDATE_ELEMENT",
              id: selectedNode.id,
              updates: { collapsed: !selectedNode.collapsed } as Partial<WhiteboardElement>,
            });
            return;
          }
        }
      }

      // Delete selected elements (including mindmap node cascade)
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        state.selectedElementIds.length > 0
      ) {
        e.preventDefault();
        const allIdsToDelete: string[] = [];
        for (const selId of state.selectedElementIds) {
          const selected = state.elements.find((el) => el.id === selId);
          if (selected?.type === "mindmap-node") {
            const cascadeIds = getMindMapCascadeDeleteIds(selId, state.elements);
            for (const id of cascadeIds) {
              if (!allIdsToDelete.includes(id)) allIdsToDelete.push(id);
            }
          } else {
            if (!allIdsToDelete.includes(selId)) allIdsToDelete.push(selId);
          }
        }
        dispatch({ type: "DELETE_ELEMENTS", ids: allIdsToDelete });
        return;
      }

      // Clear all (Ctrl+Shift+Delete)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key === "Delete"
      ) {
        e.preventDefault();
        dispatch({ type: "CLEAR_ALL" });
        return;
      }

      // Tool shortcuts (only when no modifier keys)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
        if (tool) {
          e.preventDefault();
          setTool(tool);
        }
      }

      // Stroke width adjustments
      if (e.key === "[") {
        e.preventDefault();
        const current = state.activeStyle.strokeWidth;
        dispatch({
          type: "SET_STYLE",
          style: { strokeWidth: Math.max(1, current - 1) },
        });
      }
      if (e.key === "]") {
        e.preventDefault();
        const current = state.activeStyle.strokeWidth;
        dispatch({
          type: "SET_STYLE",
          style: { strokeWidth: Math.min(20, current + 1) },
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.selectedElementIds, state.activeTool, state.elements, state.activeStyle.strokeWidth, dispatch, setTool]);

  // Paste images from system clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const img = new Image();
            img.onload = () => {
              let w = img.naturalWidth;
              let h = img.naturalHeight;
              const maxSize = 800;
              if (w > maxSize || h > maxSize) {
                const scale = maxSize / Math.max(w, h);
                w *= scale;
                h *= scale;
              }
              const maxZ = state.elements.reduce((max, el) => (el.isDeleted ? max : Math.max(max, el.zIndex)), 0) + 1;
              const imageEl: ImageElement = {
                id: nanoid(),
                type: "image",
                x: 100,
                y: 100,
                width: w,
                height: h,
                imageDataUrl: dataUrl,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
                style: { ...DEFAULT_STYLE },
                roughSeed: 0,
                isDeleted: false,
                zIndex: maxZ,
              };
              dispatch({ type: "ADD_ELEMENT", element: imageEl, select: true });
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [state.elements, dispatch]);
}
