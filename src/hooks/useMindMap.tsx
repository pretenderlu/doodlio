import { useState, useRef, useCallback } from "react";
import { nanoid } from "nanoid";
import { useWhiteboard } from "./useElements";
import { hitTest } from "../utils/hitTest";
import { getAutoColor } from "../utils/mindmapRenderer";
import { estimateNodeSize, getNodeDepth } from "../utils/mindmapHelpers";
import { worldToScreen } from "../utils/coordinates";
import { DEFAULT_STYLE } from "../types/elements";
import type {
  MindMapNodeElement,
  MindMapEdgeElement,
  WhiteboardElement,
} from "../types/elements";

interface MindMapPointerHandlers {
  handlePointerDown: (e: React.PointerEvent<HTMLCanvasElement>, getPoint: (e: React.PointerEvent) => [number, number]) => boolean;
  handlePointerMove: (e: React.PointerEvent<HTMLCanvasElement>, getPoint: (e: React.PointerEvent) => [number, number]) => boolean;
  handlePointerUp: (e: React.PointerEvent<HTMLCanvasElement>, getPoint: (e: React.PointerEvent) => [number, number]) => boolean;
  handleDoubleClick: (e: React.MouseEvent<HTMLCanvasElement>, getPoint: (e: React.PointerEvent | React.MouseEvent) => [number, number]) => void;
  nodeEditorUI: React.ReactNode;
}

const DEFAULT_FONT_SIZE = 16;

function getSiblingIndex(nodeId: string, elements: WhiteboardElement[]): number {
  const node = elements.find((e) => e.id === nodeId) as MindMapNodeElement | undefined;
  if (!node) return 0;
  const siblings = elements.filter(
    (e) => e.type === "mindmap-node" && !e.isDeleted && e.parentId === node.parentId
  );
  return siblings.findIndex((s) => s.id === nodeId);
}

export function useMindMap(
  dynamicCanvas: React.RefObject<HTMLCanvasElement | null>
): MindMapPointerHandlers {
  const { state, dispatch } = useWhiteboard();
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editPos, setEditPos] = useState({ x: 0, y: 0 });
  const isDraggingNode = useRef(false);
  const hasDragged = useRef(false);
  const dragNodeId = useRef<string | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragNodeStartPos = useRef({ x: 0, y: 0 });

  const getNextZIndex = useCallback((): number => {
    return state.elements.reduce(
      (max, el) => (el.isDeleted ? max : Math.max(max, el.zIndex)),
      0
    ) + 1;
  }, [state.elements]);

  const createNode = useCallback(
    (x: number, y: number, parentId: string | null, autoEdit: boolean): string => {
      const id = nanoid();
      const depth = parentId
        ? getNodeDepth(parentId, state.elements) + 1
        : 0;
      const sibIndex = parentId
        ? state.elements.filter(
            (e) => e.type === "mindmap-node" && !e.isDeleted && e.parentId === parentId
          ).length
        : state.elements.filter(
            (e) => e.type === "mindmap-node" && !e.isDeleted && e.parentId === null
          ).length;

      const nodeColor = getAutoColor(depth, sibIndex);

      const node: MindMapNodeElement = {
        id,
        type: "mindmap-node",
        x,
        y,
        width: 0,
        height: 0,
        style: { ...DEFAULT_STYLE },
        roughSeed: 0,
        isDeleted: false,
        zIndex: getNextZIndex(),
        textContent: "",
        fontSize: DEFAULT_FONT_SIZE,
        fontFamily: "sans-serif",
        fontColor: "#333",
        nodeColor,
        parentId,
        collapsed: false,
      };

      dispatch({ type: "ADD_ELEMENT", element: node });

      // Create edge if has parent
      if (parentId) {
        const edge: MindMapEdgeElement = {
          id: nanoid(),
          type: "mindmap-edge",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          style: { ...DEFAULT_STYLE },
          roughSeed: 0,
          isDeleted: false,
          zIndex: getNextZIndex() - 1,
          fromNodeId: parentId,
          toNodeId: id,
        };
        dispatch({ type: "ADD_ELEMENT", element: edge });
      }

      if (autoEdit) {
        setTimeout(() => {
          setEditingNodeId(id);
          setEditText("");
          setEditPos({ x, y });
        }, 50);
      }

      return id;
    },
    [state.elements, dispatch, getNextZIndex]
  );

  const commitEdit = useCallback(() => {
    if (!editingNodeId) return;
    const text = editText.trim() || "新节点";
    dispatch({
      type: "UPDATE_ELEMENT",
      id: editingNodeId,
      updates: { textContent: text } as Partial<WhiteboardElement>,
    });
    setEditingNodeId(null);
    setEditText("");
  }, [editingNodeId, editText, dispatch]);

  const startEditing = useCallback(
    (nodeId: string) => {
      const node = state.elements.find(
        (e) => e.id === nodeId && e.type === "mindmap-node"
      ) as MindMapNodeElement | undefined;
      if (!node) return;
      setEditingNodeId(nodeId);
      setEditText(node.textContent);
      setEditPos({ x: node.x, y: node.y });
    },
    [state.elements]
  );

  const clearDynamicCanvas = useCallback(() => {
    const canvas = dynamicCanvas.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  }, [dynamicCanvas]);

  // ---- Pointer handlers ----

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>, getPoint: (e: React.PointerEvent) => [number, number]): boolean => {
      if (state.activeTool !== "mindmap") return false;

      if (editingNodeId) {
        commitEdit();
      }

      const [x, y] = getPoint(e);
      const hit = hitTest(x, y, state.elements);

      if (hit && hit.type === "mindmap-node") {
        dispatch({ type: "SET_SELECTED", ids: [hit.id] });
        isDraggingNode.current = true;
        hasDragged.current = false;
        dragNodeId.current = hit.id;
        dragStartPos.current = { x, y };
        dragNodeStartPos.current = { x: hit.x, y: hit.y };
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      } else {
        dispatch({ type: "SET_SELECTED", ids: [] });
        createNode(x, y, null, true);
      }
      return true;
    },
    [state.activeTool, state.elements, editingNodeId, commitEdit, dispatch, createNode]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>, getPoint: (e: React.PointerEvent) => [number, number]): boolean => {
      if (state.activeTool !== "mindmap") return false;
      if (!isDraggingNode.current || !dragNodeId.current) return true;

      const [x, y] = getPoint(e);
      const dx = x - dragStartPos.current.x;
      const dy = y - dragStartPos.current.y;

      // Only start drag visuals after a minimum threshold
      if (!hasDragged.current && Math.abs(dx) + Math.abs(dy) > 4) {
        hasDragged.current = true;
      }
      if (!hasDragged.current) return true;

      // Draw ghost node + connection preview on dynamic canvas
      // (don't dispatch state updates — avoids flicker from useCanvas clearing)
      const canvas = dynamicCanvas.current;
      if (!canvas) return true;
      const ctx = canvas.getContext("2d");
      if (!ctx) return true;
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      const sourceNode = state.elements.find(
        (el) => el.id === dragNodeId.current && el.type === "mindmap-node"
      ) as MindMapNodeElement | undefined;
      if (!sourceNode) return true;

      const srcSize = estimateNodeSize(sourceNode);
      const ghostX = dragNodeStartPos.current.x + dx;
      const ghostY = dragNodeStartPos.current.y + dy;

      // Draw ghost node at drag position
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = sourceNode.nodeColor;
      ctx.beginPath();
      ctx.roundRect(ghostX, ghostY, srcSize.width, srcSize.height, 8);
      ctx.fill();
      ctx.strokeStyle = "#4a90d9";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Hit test other nodes (exclude dragged node)
      const filteredElements = state.elements.filter(
        (el) => el.id !== dragNodeId.current
      );
      const hoveredEl = hitTest(x, y, filteredElements);

      if (hoveredEl && hoveredEl.type === "mindmap-node") {
        const targetNode = hoveredEl as MindMapNodeElement;
        const targetSize = estimateNodeSize(targetNode);

        // Highlight target node
        ctx.save();
        ctx.strokeStyle = "#4a90d9";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(
          targetNode.x - 3,
          targetNode.y - 3,
          targetSize.width + 6,
          targetSize.height + 6,
          10
        );
        ctx.stroke();
        ctx.restore();

        // Draw bezier connection preview (source right-center → target left-center)
        const fromX = dragNodeStartPos.current.x + srcSize.width;
        const fromY = dragNodeStartPos.current.y + srcSize.height / 2;
        const toX = targetNode.x;
        const toY = targetNode.y + targetSize.height / 2;

        ctx.save();
        ctx.strokeStyle = "#4a90d9";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        const cpOffset = Math.max(40, Math.abs(toX - fromX) * 0.4);
        ctx.bezierCurveTo(fromX + cpOffset, fromY, toX - cpOffset, toY, toX, toY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      return true;
    },
    [state.activeTool, state.elements, dynamicCanvas]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>, getPoint: (e: React.PointerEvent) => [number, number]): boolean => {
      if (state.activeTool !== "mindmap") return false;

      if (isDraggingNode.current && dragNodeId.current) {
        const sourceId = dragNodeId.current;

        clearDynamicCanvas();

        if (hasDragged.current) {
          const [x, y] = getPoint(e);

          // Check if dropped on another mindmap node
          const filteredElements = state.elements.filter((el) => el.id !== sourceId);
          const hit = hitTest(x, y, filteredElements);

          if (hit && hit.type === "mindmap-node" && hit.id !== sourceId) {
            // --- Create connection ---
            const targetId = hit.id;

            // Check if edge already exists (in either direction)
            const edgeExists = state.elements.some(
              (el) =>
                el.type === "mindmap-edge" &&
                !el.isDeleted &&
                ((el.fromNodeId === sourceId && el.toNodeId === targetId) ||
                  (el.fromNodeId === targetId && el.toNodeId === sourceId))
            );

            if (!edgeExists) {
              // Remove old edge pointing to target if re-parenting
              const oldEdge = state.elements.find(
                (el) =>
                  el.type === "mindmap-edge" &&
                  !el.isDeleted &&
                  el.toNodeId === targetId
              );
              if (oldEdge) {
                dispatch({ type: "DELETE_ELEMENT", id: oldEdge.id });
              }

              // Update target's parentId
              dispatch({
                type: "UPDATE_ELEMENT",
                id: targetId,
                updates: { parentId: sourceId } as Partial<WhiteboardElement>,
              });

              // Create new edge
              const edge: MindMapEdgeElement = {
                id: nanoid(),
                type: "mindmap-edge",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                style: { ...DEFAULT_STYLE },
                roughSeed: 0,
                isDeleted: false,
                zIndex: getNextZIndex(),
                fromNodeId: sourceId,
                toNodeId: targetId,
              };
              dispatch({ type: "ADD_ELEMENT", element: edge });
            }
            // Node stays at original position (no move)
          } else {
            // --- Move the node ---
            const dx = x - dragStartPos.current.x;
            const dy = y - dragStartPos.current.y;
            dispatch({
              type: "UPDATE_ELEMENT",
              id: sourceId,
              updates: {
                x: dragNodeStartPos.current.x + dx,
                y: dragNodeStartPos.current.y + dy,
              } as Partial<WhiteboardElement>,
            });
          }
        }

        isDraggingNode.current = false;
        hasDragged.current = false;
        dragNodeId.current = null;
        (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
      }
      return true;
    },
    [state.activeTool, state.elements, dispatch, clearDynamicCanvas, getNextZIndex]
  );

  const handleDoubleClick = useCallback(
    (_e: React.MouseEvent<HTMLCanvasElement>, getPoint: (e: React.PointerEvent | React.MouseEvent) => [number, number]) => {
      if (state.activeTool !== "mindmap") return;
      const [x, y] = getPoint(_e as unknown as React.PointerEvent);
      const hit = hitTest(x, y, state.elements);
      if (hit && hit.type === "mindmap-node") {
        startEditing(hit.id);
      }
    },
    [state.activeTool, state.elements, startEditing]
  );

  // ---- Inline editor UI ----
  const nodeEditorUI = editingNodeId ? (() => {
    const [screenX, screenY] = worldToScreen(editPos.x, editPos.y, state.viewport);
    return (
      <div
        style={{
          position: "absolute",
          left: screenX,
          top: screenY,
          zIndex: 500,
          transformOrigin: "top left",
          transform: `scale(${state.viewport.zoom})`,
        }}
      >
        <input
          autoFocus
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitEdit();
            }
            if (e.key === "Escape") {
              setEditingNodeId(null);
              setEditText("");
            }
          }}
          placeholder="输入节点内容..."
          style={{
            padding: "6px 12px",
            fontSize: DEFAULT_FONT_SIZE,
            border: "2px solid #4a90d9",
            borderRadius: 8,
            outline: "none",
            minWidth: 120,
            background: "#fff",
            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
          }}
        />
      </div>
    );
  })() : null;

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
    nodeEditorUI,
  };
}

// Exported for use in keyboard shortcuts
export { getSiblingIndex };
