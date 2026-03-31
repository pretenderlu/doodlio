import { useReducer, useCallback, createContext, useContext } from "react";
import { nanoid } from "nanoid";
import type {
  WhiteboardState,
  WhiteboardAction,
  WhiteboardElement,
  GroupElement,
  ToolType,
  StyleOptions,
  EraserMode,
  PenLineStyle,
} from "../types/elements";
import { DEFAULT_STYLE } from "../types/elements";
import { DEFAULT_VIEWPORT, MIN_ZOOM, MAX_ZOOM } from "../types/viewport";

const MAX_UNDO = 50;
const DEFAULT_LAYER_ID = "layer-default";

const initialState: WhiteboardState = {
  elements: [],
  activeTool: "select",
  activeStyle: { ...DEFAULT_STYLE },
  selectedElementIds: [],
  eraserMode: "stroke",
  eraserSize: 20,
  laserDuration: 1500,
  viewport: { ...DEFAULT_VIEWPORT },
  undoStack: [],
  redoStack: [],
  textFontFamily: "sans-serif",
  textFontSize: 20,
  textShowBorder: false,
  textFontColor: "#1e1e1e",
  penLineStyle: "default",
  layers: [{ id: DEFAULT_LAYER_ID, name: "图层 1", visible: true, locked: false, order: 0 }],
  activeLayerId: DEFAULT_LAYER_ID,
};

function cloneElements(elements: WhiteboardElement[]): WhiteboardElement[] {
  return elements.map((el) => ({ ...el, _roughDrawable: undefined }));
}

function pushUndo(state: WhiteboardState): WhiteboardElement[][] {
  return [
    ...state.undoStack.slice(-(MAX_UNDO - 1)),
    cloneElements(state.elements),
  ];
}

function whiteboardReducer(
  state: WhiteboardState,
  action: WhiteboardAction
): WhiteboardState {
  switch (action.type) {
    case "ADD_ELEMENT": {
      const elWithLayer = action.element.layerId
        ? action.element
        : { ...action.element, layerId: state.activeLayerId } as WhiteboardElement;
      const newState: WhiteboardState = {
        ...state,
        elements: [...state.elements, elWithLayer],
        undoStack: pushUndo(state),
        redoStack: [],
      };
      if (action.select) {
        newState.activeTool = "select";
        newState.selectedElementIds = [action.element.id];
      }
      return newState;
    }

    case "UPDATE_ELEMENT": {
      return {
        ...state,
        elements: state.elements.map((el) =>
          el.id === action.id
            ? ({ ...el, ...action.updates, _roughDrawable: undefined } as WhiteboardElement)
            : el
        ),
        undoStack: pushUndo(state),
        redoStack: [],
      };
    }

    case "UPDATE_ELEMENTS": {
      if (action.updates.length === 0) return state;
      const updateMap = new Map(action.updates.map((u) => [u.id, u.updates]));
      return {
        ...state,
        elements: state.elements.map((el) => {
          const upd = updateMap.get(el.id);
          if (upd) {
            return { ...el, ...upd, _roughDrawable: undefined } as WhiteboardElement;
          }
          return el;
        }),
        undoStack: pushUndo(state),
        redoStack: [],
      };
    }

    case "DELETE_ELEMENT": {
      return {
        ...state,
        elements: state.elements.map((el) =>
          el.id === action.id ? { ...el, isDeleted: true } : el
        ),
        undoStack: pushUndo(state),
        redoStack: [],
        selectedElementIds: state.selectedElementIds.filter((id) => id !== action.id),
      };
    }

    case "DELETE_ELEMENTS": {
      const ids = new Set(action.ids);
      if (ids.size === 0) return state;
      return {
        ...state,
        elements: state.elements.map((el) =>
          ids.has(el.id) ? { ...el, isDeleted: true } : el
        ),
        undoStack: pushUndo(state),
        redoStack: [],
        selectedElementIds: state.selectedElementIds.filter((id) => !ids.has(id)),
      };
    }

    case "CLEAR_ALL": {
      const hasVisible = state.elements.some((el) => !el.isDeleted);
      if (!hasVisible) return state;
      return {
        ...state,
        elements: state.elements.map((el) => ({ ...el, isDeleted: true })),
        undoStack: pushUndo(state),
        redoStack: [],
        selectedElementIds: [],
      };
    }

    case "SET_ELEMENTS":
      return { ...state, elements: action.elements };

    case "LAYOUT_MINDMAP": {
      const positions = action.positions;
      if (positions.size === 0) return state;
      return {
        ...state,
        elements: state.elements.map((el) => {
          const pos = positions.get(el.id);
          if (pos) {
            return { ...el, x: pos.x, y: pos.y, _roughDrawable: undefined } as WhiteboardElement;
          }
          return el;
        }),
        undoStack: pushUndo(state),
        redoStack: [],
      };
    }

    case "SET_TOOL":
      return {
        ...state,
        activeTool: action.tool,
        selectedElementIds:
          action.tool !== "select" ? [] : state.selectedElementIds,
      };

    case "SET_ERASER_MODE":
      return { ...state, eraserMode: action.mode };

    case "SET_ERASER_SIZE":
      return { ...state, eraserSize: action.size };

    case "SET_LASER_DURATION":
      return { ...state, laserDuration: action.duration };

    case "SET_STYLE":
      return {
        ...state,
        activeStyle: { ...state.activeStyle, ...action.style },
      };

    case "SET_SELECTED":
      return { ...state, selectedElementIds: action.ids };

    case "TOGGLE_SELECTED": {
      const idx = state.selectedElementIds.indexOf(action.id);
      const next = idx >= 0
        ? state.selectedElementIds.filter((id) => id !== action.id)
        : [...state.selectedElementIds, action.id];
      return { ...state, selectedElementIds: next };
    }

    case "UNDO": {
      if (state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      return {
        ...state,
        elements: prev,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [
          ...state.redoStack.slice(-(MAX_UNDO - 1)),
          cloneElements(state.elements),
        ],
        selectedElementIds: [],
      };
    }

    case "REDO": {
      if (state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      return {
        ...state,
        elements: next,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [
          ...state.undoStack.slice(-(MAX_UNDO - 1)),
          cloneElements(state.elements),
        ],
        selectedElementIds: [],
      };
    }

    case "REORDER_ELEMENT": {
      const { id, direction } = action;
      const visible = state.elements.filter((el) => !el.isDeleted);
      const sorted = [...visible].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((el) => el.id === id);
      if (idx === -1) return state;

      let newOrder = sorted.map((el) => el.id);
      if (direction === "front") {
        newOrder = [...newOrder.filter((eid) => eid !== id), id];
      } else if (direction === "back") {
        newOrder = [id, ...newOrder.filter((eid) => eid !== id)];
      } else if (direction === "forward" && idx < newOrder.length - 1) {
        [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
      } else if (direction === "backward" && idx > 0) {
        [newOrder[idx], newOrder[idx - 1]] = [newOrder[idx - 1], newOrder[idx]];
      }

      const zMap = new Map(newOrder.map((eid, i) => [eid, i]));
      return {
        ...state,
        elements: state.elements.map((el) => {
          const z = zMap.get(el.id);
          return z !== undefined ? { ...el, zIndex: z, _roughDrawable: undefined } as WhiteboardElement : el;
        }),
        undoStack: pushUndo(state),
        redoStack: [],
      };
    }

    case "DUPLICATE_ELEMENT": {
      const source = state.elements.find((el) => el.id === action.id && !el.isDeleted);
      if (!source) return state;

      const maxZ = state.elements.reduce((max, el) => (el.isDeleted ? max : Math.max(max, el.zIndex)), 0) + 1;
      const clone = {
        ...source,
        id: nanoid(),
        x: source.x + 20,
        y: source.y + 20,
        zIndex: maxZ,
        _roughDrawable: undefined,
      } as WhiteboardElement;

      return {
        ...state,
        elements: [...state.elements, clone],
        selectedElementIds: [clone.id],
        undoStack: pushUndo(state),
        redoStack: [],
      };
    }

    case "SET_VIEWPORT":
      return { ...state, viewport: action.viewport };

    case "ZOOM_TO": {
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, action.zoom));
      const { centerX, centerY } = action;
      // Zoom towards the cursor position (centerX/centerY are screen coords)
      const oldZoom = state.viewport.zoom;
      const panX = centerX - (centerX - state.viewport.panX) * (newZoom / oldZoom);
      const panY = centerY - (centerY - state.viewport.panY) * (newZoom / oldZoom);
      return { ...state, viewport: { panX, panY, zoom: newZoom } };
    }

    case "PAN_BY":
      return {
        ...state,
        viewport: {
          ...state.viewport,
          panX: state.viewport.panX + action.dx,
          panY: state.viewport.panY + action.dy,
        },
      };

    case "RESET_VIEWPORT":
      return { ...state, viewport: { ...DEFAULT_VIEWPORT } };

    case "SET_TEXT_STYLE":
      return {
        ...state,
        textFontFamily: action.fontFamily ?? state.textFontFamily,
        textFontSize: action.fontSize ?? state.textFontSize,
        textShowBorder: action.showBorder ?? state.textShowBorder,
        textFontColor: action.fontColor ?? state.textFontColor,
      };

    case "SET_PEN_LINE_STYLE":
      return { ...state, penLineStyle: action.lineStyle };

    case "GROUP_ELEMENTS": {
      const ids = action.ids;
      if (ids.length < 2) return state;
      const targets = state.elements.filter((el) => ids.includes(el.id) && !el.isDeleted);
      if (targets.length < 2) return state;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const el of targets) {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + el.width);
        maxY = Math.max(maxY, el.y + el.height);
      }
      const maxZ = state.elements.reduce((max, el) => (el.isDeleted ? max : Math.max(max, el.zIndex)), 0) + 1;
      const groupId = nanoid();
      const group: GroupElement = {
        id: groupId,
        type: "group",
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        style: { ...DEFAULT_STYLE },
        roughSeed: 0,
        isDeleted: false,
        zIndex: maxZ,
        childIds: ids,
      };
      return {
        ...state,
        elements: [
          ...state.elements.map((el) =>
            ids.includes(el.id) ? { ...el, groupId, _roughDrawable: undefined } as WhiteboardElement : el
          ),
          group,
        ],
        selectedElementIds: [groupId],
        undoStack: pushUndo(state),
        redoStack: [],
      };
    }

    case "UNGROUP_ELEMENTS": {
      const group = state.elements.find((el) => el.id === action.groupId && el.type === "group" && !el.isDeleted) as GroupElement | undefined;
      if (!group) return state;
      return {
        ...state,
        elements: state.elements.map((el) => {
          if (el.id === action.groupId) return { ...el, isDeleted: true };
          if (group.childIds.includes(el.id)) return { ...el, groupId: undefined, _roughDrawable: undefined } as WhiteboardElement;
          return el;
        }),
        selectedElementIds: group.childIds,
        undoStack: pushUndo(state),
        redoStack: [],
      };
    }

    case "TOGGLE_LOCK": {
      return {
        ...state,
        elements: state.elements.map((el) =>
          el.id === action.id ? { ...el, locked: !el.locked, _roughDrawable: undefined } as WhiteboardElement : el
        ),
      };
    }

    case "TOGGLE_HIDDEN": {
      return {
        ...state,
        elements: state.elements.map((el) =>
          el.id === action.id ? { ...el, isHidden: !el.isHidden, _roughDrawable: undefined } as WhiteboardElement : el
        ),
      };
    }

    case "PASTE_ELEMENTS": {
      if (action.elements.length === 0) return state;
      const pastedEls = action.elements.map((el) => ({
        ...el,
        layerId: el.layerId || state.activeLayerId,
      } as WhiteboardElement));
      const newIds = pastedEls.map((el) => el.id);
      return {
        ...state,
        elements: [...state.elements, ...pastedEls],
        selectedElementIds: newIds,
        undoStack: pushUndo(state),
        redoStack: [],
      };
    }

    case "ADD_LAYER": {
      return {
        ...state,
        layers: [...state.layers, action.layer],
        activeLayerId: action.layer.id,
      };
    }

    case "DELETE_LAYER": {
      if (state.layers.length <= 1) return state; // must keep at least 1
      const remaining = state.layers.filter((l) => l.id !== action.layerId);
      // Move elements from deleted layer to the active layer (or first remaining)
      const fallbackId = state.activeLayerId === action.layerId
        ? remaining[0].id
        : state.activeLayerId;
      return {
        ...state,
        layers: remaining,
        activeLayerId: fallbackId,
        elements: state.elements.map((el) =>
          el.layerId === action.layerId
            ? { ...el, layerId: fallbackId, _roughDrawable: undefined } as WhiteboardElement
            : el
        ),
      };
    }

    case "UPDATE_LAYER": {
      return {
        ...state,
        layers: state.layers.map((l) =>
          l.id === action.layerId ? { ...l, ...action.updates } : l
        ),
      };
    }

    case "SET_ACTIVE_LAYER": {
      return { ...state, activeLayerId: action.layerId };
    }

    case "REORDER_LAYER": {
      const sorted = [...state.layers].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((l) => l.id === action.layerId);
      if (idx === -1) return state;
      const swapIdx = action.direction === "up" ? idx + 1 : idx - 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return state;
      const temp = sorted[idx].order;
      sorted[idx] = { ...sorted[idx], order: sorted[swapIdx].order };
      sorted[swapIdx] = { ...sorted[swapIdx], order: temp };
      return { ...state, layers: sorted };
    }

    default:
      return state;
  }
}

// ---- Context ----

interface WhiteboardContextValue {
  state: WhiteboardState;
  dispatch: React.Dispatch<WhiteboardAction>;
  setTool: (tool: ToolType) => void;
  setStyle: (style: Partial<StyleOptions>) => void;
  setEraserMode: (mode: EraserMode) => void;
  setEraserSize: (size: number) => void;
  setLaserDuration: (duration: number) => void;
  setPenLineStyle: (lineStyle: PenLineStyle) => void;
  reorderElement: (id: string, direction: "front" | "back" | "forward" | "backward") => void;
  duplicateElement: (id: string) => void;
  zoomTo: (zoom: number, centerX: number, centerY: number) => void;
  panBy: (dx: number, dy: number) => void;
  resetViewport: () => void;
}

const WhiteboardContext = createContext<WhiteboardContextValue | null>(null);

export function WhiteboardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(whiteboardReducer, initialState);

  const setTool = useCallback(
    (tool: ToolType) => dispatch({ type: "SET_TOOL", tool }),
    [dispatch]
  );

  const setStyle = useCallback(
    (style: Partial<StyleOptions>) => dispatch({ type: "SET_STYLE", style }),
    [dispatch]
  );

  const setEraserMode = useCallback(
    (mode: EraserMode) => dispatch({ type: "SET_ERASER_MODE", mode }),
    [dispatch]
  );

  const setEraserSize = useCallback(
    (size: number) => dispatch({ type: "SET_ERASER_SIZE", size }),
    [dispatch]
  );

  const setLaserDuration = useCallback(
    (duration: number) => dispatch({ type: "SET_LASER_DURATION", duration }),
    [dispatch]
  );

  const setPenLineStyle = useCallback(
    (lineStyle: PenLineStyle) => dispatch({ type: "SET_PEN_LINE_STYLE", lineStyle }),
    [dispatch]
  );

  const reorderElement = useCallback(
    (id: string, direction: "front" | "back" | "forward" | "backward") =>
      dispatch({ type: "REORDER_ELEMENT", id, direction }),
    [dispatch]
  );

  const duplicateElement = useCallback(
    (id: string) => dispatch({ type: "DUPLICATE_ELEMENT", id }),
    [dispatch]
  );

  const zoomTo = useCallback(
    (zoom: number, centerX: number, centerY: number) =>
      dispatch({ type: "ZOOM_TO", zoom, centerX, centerY }),
    [dispatch]
  );

  const panBy = useCallback(
    (dx: number, dy: number) => dispatch({ type: "PAN_BY", dx, dy }),
    [dispatch]
  );

  const resetViewport = useCallback(
    () => dispatch({ type: "RESET_VIEWPORT" }),
    [dispatch]
  );

  return (
    <WhiteboardContext.Provider value={{ state, dispatch, setTool, setStyle, setEraserMode, setEraserSize, setLaserDuration, setPenLineStyle, reorderElement, duplicateElement, zoomTo, panBy, resetViewport }}>
      {children}
    </WhiteboardContext.Provider>
  );
}

export function useWhiteboard(): WhiteboardContextValue {
  const ctx = useContext(WhiteboardContext);
  if (!ctx) throw new Error("useWhiteboard must be used within WhiteboardProvider");
  return ctx;
}
