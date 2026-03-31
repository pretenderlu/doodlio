import type { Drawable } from "roughjs/bin/core";
import type { Viewport } from "./viewport";

// ---- Style ----
export type FillStyle = "hachure" | "cross-hatch" | "solid";
export type PenLineStyle = "default" | "sketchy";
export type MindMapLayoutDirection = "right" | "down" | "radial";

export interface StyleOptions {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  roughness: number; // 0 = clean, 1 = normal, 2 = very rough
  opacity: number; // 0-1
  fillStyle: FillStyle;
  strokeDasharray: number[]; // [] = solid
  cornerRadius: number; // 0 = sharp corners
}

export const DEFAULT_STYLE: StyleOptions = {
  strokeColor: "#1e1e1e",
  fillColor: "transparent",
  strokeWidth: 2,
  roughness: 1,
  opacity: 1,
  fillStyle: "hachure",
  strokeDasharray: [],
  cornerRadius: 0,
};

// ---- Tool types ----
export type ToolType =
  | "select"
  | "pen"
  | "highlighter"
  | "laser"
  | "line"
  | "rectangle"
  | "ellipse"
  | "arrow"
  | "text"
  | "eraser"
  | "image"
  | "mindmap"
  | "hand";

// ---- Eraser modes ----
export type EraserMode = "stroke" | "area" | "pixel";

// ---- Layer ----
export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  order: number; // lower = further back
}

// ---- Element base ----
interface ElementBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style: StyleOptions;
  roughSeed: number;
  isDeleted: boolean;
  zIndex: number;
  rotation?: number; // radians, 0 = no rotation
  locked?: boolean;   // prevent selection/move when true
  isHidden?: boolean; // hide from canvas when true
  groupId?: string;   // parent group ID
  layerId?: string;   // which layer this element belongs to
  // transient cache — not serialized
  _roughDrawable?: Drawable | Drawable[];
}

// ---- Concrete element types ----
export interface PenElement extends ElementBase {
  type: "pen";
  points: number[][]; // [x, y, pressure?]
  highlighter?: boolean; // true = semi-transparent wide marker stroke
  lineStyle?: PenLineStyle; // "default" = perfect-freehand, "sketchy" = rough.js
}

export interface LineElement extends ElementBase {
  type: "line";
  points: number[][]; // [[x0,y0], [x1,y1]]
}

export interface RectangleElement extends ElementBase {
  type: "rectangle";
}

export interface EllipseElement extends ElementBase {
  type: "ellipse";
}

export interface ArrowElement extends ElementBase {
  type: "arrow";
  points: number[][]; // [[x0,y0], [x1,y1]]
}

export interface TextElement extends ElementBase {
  type: "text";
  textContent: string;
  fontSize: number;
  fontFamily: string;
  showBorder?: boolean; // when true, draw rough.js border around text
  fontColor?: string;   // independent font color (used when showBorder is true; fallback to strokeColor)
}

export interface ImageElement extends ElementBase {
  type: "image";
  imageDataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
}

export interface MindMapNodeElement extends ElementBase {
  type: "mindmap-node";
  textContent: string;
  fontSize: number;
  fontFamily: string;
  fontColor: string;
  nodeColor: string;
  parentId: string | null;  // null = root node
  collapsed: boolean;
}

export interface MindMapEdgeElement extends ElementBase {
  type: "mindmap-edge";
  fromNodeId: string;
  toNodeId: string;
}

export interface PixelEraserElement extends ElementBase {
  type: "pixel-eraser";
  points: number[][]; // [x, y]
  eraserSize: number;
}

export interface GroupElement extends ElementBase {
  type: "group";
  childIds: string[];
}

// ---- Discriminated union ----
export type WhiteboardElement =
  | PenElement
  | LineElement
  | RectangleElement
  | EllipseElement
  | ArrowElement
  | TextElement
  | ImageElement
  | MindMapNodeElement
  | MindMapEdgeElement
  | PixelEraserElement
  | GroupElement;

// ---- State ----
export interface WhiteboardState {
  elements: WhiteboardElement[];
  activeTool: ToolType;
  activeStyle: StyleOptions;
  selectedElementIds: string[];
  eraserMode: EraserMode;
  eraserSize: number; // pixel eraser brush size
  laserDuration: number; // trail lifetime in ms
  viewport: Viewport;
  undoStack: WhiteboardElement[][];
  redoStack: WhiteboardElement[][];
  textFontFamily: string;
  textFontSize: number;
  textShowBorder: boolean;
  textFontColor: string;
  penLineStyle: PenLineStyle;
  layers: Layer[];
  activeLayerId: string;
}

// ---- Actions ----
export type WhiteboardAction =
  | { type: "ADD_ELEMENT"; element: WhiteboardElement; select?: boolean }
  | { type: "UPDATE_ELEMENT"; id: string; updates: Partial<WhiteboardElement> }
  | { type: "UPDATE_ELEMENTS"; updates: Array<{ id: string; updates: Partial<WhiteboardElement> }> }
  | { type: "DELETE_ELEMENT"; id: string }
  | { type: "DELETE_ELEMENTS"; ids: string[] }
  | { type: "SET_ELEMENTS"; elements: WhiteboardElement[] }
  | { type: "SET_TOOL"; tool: ToolType }
  | { type: "SET_STYLE"; style: Partial<StyleOptions> }
  | { type: "SET_SELECTED"; ids: string[] }
  | { type: "TOGGLE_SELECTED"; id: string }
  | { type: "SET_ERASER_MODE"; mode: EraserMode }
  | { type: "SET_ERASER_SIZE"; size: number }
  | { type: "SET_LASER_DURATION"; duration: number }
  | { type: "CLEAR_ALL" }
  | { type: "LAYOUT_MINDMAP"; positions: Map<string, { x: number; y: number }> }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "REORDER_ELEMENT"; id: string; direction: "front" | "back" | "forward" | "backward" }
  | { type: "DUPLICATE_ELEMENT"; id: string }
  | { type: "SET_VIEWPORT"; viewport: Viewport }
  | { type: "ZOOM_TO"; zoom: number; centerX: number; centerY: number }
  | { type: "PAN_BY"; dx: number; dy: number }
  | { type: "RESET_VIEWPORT" }
  | { type: "SET_TEXT_STYLE"; fontFamily?: string; fontSize?: number; showBorder?: boolean; fontColor?: string }
  | { type: "SET_PEN_LINE_STYLE"; lineStyle: PenLineStyle }
  | { type: "GROUP_ELEMENTS"; ids: string[] }
  | { type: "UNGROUP_ELEMENTS"; groupId: string }
  | { type: "TOGGLE_LOCK"; id: string }
  | { type: "TOGGLE_HIDDEN"; id: string }
  | { type: "PASTE_ELEMENTS"; elements: WhiteboardElement[] }
  | { type: "ADD_LAYER"; layer: Layer }
  | { type: "DELETE_LAYER"; layerId: string }
  | { type: "UPDATE_LAYER"; layerId: string; updates: Partial<Layer> }
  | { type: "SET_ACTIVE_LAYER"; layerId: string }
  | { type: "REORDER_LAYER"; layerId: string; direction: "up" | "down" };
