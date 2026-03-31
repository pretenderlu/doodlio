import type { EraserMode } from "../types/elements";

export interface ToolDef {
  key: string;
  label: string;
  icon: string; // key for renderToolIcon
  shortcut?: string;
  group: "tool" | "action";
}

export const TOOLS: ToolDef[] = [
  { key: "select", label: "选择", icon: "select", shortcut: "V", group: "tool" },
  { key: "pen", label: "画笔", icon: "pen", shortcut: "P", group: "tool" },
  { key: "highlighter", label: "荧光笔", icon: "highlighter", shortcut: "H", group: "tool" },
  { key: "laser", label: "激光笔", icon: "laser", shortcut: "G", group: "tool" },
  { key: "line", label: "直线", icon: "line", shortcut: "L", group: "tool" },
  { key: "rectangle", label: "矩形", icon: "rectangle", shortcut: "R", group: "tool" },
  { key: "ellipse", label: "椭圆", icon: "ellipse", shortcut: "O", group: "tool" },
  { key: "arrow", label: "箭头", icon: "arrow", shortcut: "A", group: "tool" },
  { key: "text", label: "文字", icon: "text", shortcut: "T", group: "tool" },
  { key: "eraser", label: "橡皮擦", icon: "eraser", shortcut: "E", group: "tool" },
  { key: "mindmap", label: "脑图", icon: "mindmap", shortcut: "M", group: "tool" },
  { key: "hand", label: "抓手", icon: "hand", shortcut: "Space", group: "tool" },
];

export const ACTION_ITEMS: ToolDef[] = [
  { key: "image", label: "插入图片", icon: "image", group: "action" },
  { key: "undo", label: "撤销", icon: "undo", shortcut: "Ctrl+Z", group: "action" },
  { key: "redo", label: "重做", icon: "redo", shortcut: "Ctrl+Shift+Z", group: "action" },
  { key: "clear", label: "清除全部", icon: "clear", group: "action" },
  { key: "layout", label: "整理布局", icon: "layout", group: "action" },
];

export const ALL_FAVORITABLE = [...TOOLS, ...ACTION_ITEMS];

// ── Minimalist SVG icons (1.5px stroke, no fill) ──
const S = 20; // viewBox size
const P: React.SVGAttributes<SVGElement> = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} {...P}>
      {children}
    </svg>
  );
}

const ICON_MAP: Record<string, () => React.ReactNode> = {
  // ── Tools ──
  select: () => (
    <Svg>
      <path d="M5,3 L5,15 L9,11.5 L13,17 L15,16 L11,10 L15.5,9 Z" />
    </Svg>
  ),
  pen: () => (
    <Svg>
      <path d="M12,3 L17,8 L7,18 L2,18 L2,13 Z" />
      <line x1={12} y1={3} x2={17} y2={8} />
      <line x1={2} y1={13} x2={7} y2={18} />
    </Svg>
  ),
  highlighter: () => (
    <Svg>
      <path d="M14,2 L18,6 L9,15 L3,17 L5,11 Z" />
      <line x1={5} y1={11} x2={9} y2={15} />
      <line x1={2} y1={18} x2={6} y2={18} />
    </Svg>
  ),
  laser: () => (
    <Svg>
      <circle cx={10} cy={10} r={3} />
      <circle cx={10} cy={10} r={6} strokeDasharray="3,3" />
    </Svg>
  ),
  line: () => (
    <Svg>
      <line x1={4} y1={16} x2={16} y2={4} />
    </Svg>
  ),
  rectangle: () => (
    <Svg>
      <rect x={3} y={4} width={14} height={12} rx={1.5} />
    </Svg>
  ),
  ellipse: () => (
    <Svg>
      <ellipse cx={10} cy={10} rx={7} ry={5.5} />
    </Svg>
  ),
  arrow: () => (
    <Svg>
      <line x1={3} y1={17} x2={17} y2={3} />
      <polyline points="10,3 17,3 17,10" />
    </Svg>
  ),
  text: () => (
    <Svg>
      <line x1={4} y1={4} x2={16} y2={4} />
      <line x1={10} y1={4} x2={10} y2={17} />
      <line x1={7} y1={17} x2={13} y2={17} />
    </Svg>
  ),
  eraser: () => (
    <Svg>
      <path d="M10,2 L18,8 L13,15 L3,15 L2,12 Z" />
      <line x1={7} y1={15} x2={13} y2={15} />
      <line x1={6.5} y1={8.5} x2={13} y2={15} />
      <line x1={2} y1={18} x2={18} y2={18} />
    </Svg>
  ),
  mindmap: () => (
    <Svg>
      <circle cx={10} cy={10} r={2.5} />
      <circle cx={3} cy={4} r={1.5} />
      <circle cx={17} cy={4} r={1.5} />
      <circle cx={4} cy={17} r={1.5} />
      <circle cx={17} cy={16} r={1.5} />
      <line x1={8} y1={8} x2={4.5} y2={5} />
      <line x1={12} y1={8} x2={15.5} y2={5} />
      <line x1={8} y1={12} x2={5} y2={15.5} />
      <line x1={12} y1={12} x2={15.5} y2={14.5} />
    </Svg>
  ),
  layout: () => (
    <Svg>
      <rect x={7} y={2} width={6} height={4} rx={1} />
      <rect x={1} y={14} width={6} height={4} rx={1} />
      <rect x={13} y={14} width={6} height={4} rx={1} />
      <line x1={10} y1={6} x2={10} y2={10} />
      <line x1={4} y1={10} x2={16} y2={10} />
      <line x1={4} y1={10} x2={4} y2={14} />
      <line x1={16} y1={10} x2={16} y2={14} />
    </Svg>
  ),
  hand: () => (
    <Svg>
      <line x1={10} y1={2} x2={10} y2={18} />
      <line x1={2} y1={10} x2={18} y2={10} />
      <polyline points="7,5 10,2 13,5" />
      <polyline points="7,15 10,18 13,15" />
      <polyline points="5,7 2,10 5,13" />
      <polyline points="15,7 18,10 15,13" />
    </Svg>
  ),

  // ── Actions ──
  image: () => (
    <Svg>
      <rect x={2} y={3} width={16} height={14} rx={2} />
      <circle cx={7} cy={8} r={2} />
      <polyline points="2,15 7,10 10,13 14,8 18,13" />
    </Svg>
  ),
  undo: () => (
    <Svg>
      <path d="M4,10 A7,7 0 1,1 10,17" />
      <polyline points="4,5 4,10 9,10" />
    </Svg>
  ),
  redo: () => (
    <Svg>
      <path d="M16,10 A7,7 0 1,0 10,17" />
      <polyline points="16,5 16,10 11,10" />
    </Svg>
  ),
  clear: () => (
    <Svg>
      <path d="M4,5 L5,17 Q5,18 6,18 L14,18 Q15,18 15,17 L16,5" />
      <line x1={2} y1={5} x2={18} y2={5} />
      <path d="M7,5 L7,3 Q7,2 8,2 L12,2 Q13,2 13,3 L13,5" />
      <line x1={8} y1={8} x2={8} y2={15} />
      <line x1={12} y1={8} x2={12} y2={15} />
    </Svg>
  ),

  // ── Right toolbar ──
  slides: () => (
    <Svg>
      <rect x={2} y={4} width={16} height={12} rx={1.5} />
      <line x1={6} y1={4} x2={6} y2={16} />
      <line x1={14} y1={4} x2={14} y2={16} />
      <line x1={2} y1={10} x2={6} y2={10} />
      <line x1={14} y1={10} x2={18} y2={10} />
    </Svg>
  ),
  teleprompter: () => (
    <Svg>
      <rect x={3} y={2} width={14} height={16} rx={1.5} />
      <line x1={6} y1={6} x2={14} y2={6} />
      <line x1={6} y1={9} x2={14} y2={9} />
      <line x1={6} y1={12} x2={11} y2={12} />
    </Svg>
  ),
  settings: () => (
    <Svg>
      <circle cx={10} cy={10} r={2.5} />
      <path d="M8.5,2 L11.5,2 L12,4.2 L14,5 L16,3.8 L18,5.8 L16.5,7.8 L17,9.5 L19,10 L19,13 L17,13.3 L16.5,15 L18,17 L16,19 L14,17.5 L12,18 L11.5,20 L8.5,20 L8,18 L6,17.5 L4,19 L2,17 L3.5,15 L3,13.3 L1,13 L1,10 L3,9.5 L3.5,7.8 L2,5.8 L4,3.8 L6,5 L8,4.2 Z"
        transform="translate(0,-1) scale(0.95) translate(0.5,0.5)" />
    </Svg>
  ),
  capture: () => (
    <Svg>
      <rect x={2} y={4} width={16} height={11} rx={1.5} />
      <circle cx={13} cy={9} r={2} />
      <circle cx={5} cy={9} r={1} />
      <line x1={7} y1={15} x2={13} y2={15} />
      <line x1={10} y1={15} x2={10} y2={17} />
      <line x1={6} y1={17} x2={14} y2={17} />
    </Svg>
  ),
  "record-stop": () => (
    <Svg>
      <rect x={5} y={5} width={10} height={10} rx={1} />
    </Svg>
  ),
  "layers": () => (
    <Svg>
      <rect x={4} y={12} width={12} height={3} rx={1} />
      <rect x={3} y={8} width={14} height={3} rx={1} opacity={0.7} />
      <rect x={2} y={4} width={16} height={3} rx={1} opacity={0.4} />
    </Svg>
  ),
  "markdown": () => (
    <Svg>
      <rect x={2} y={3} width={16} height={14} rx={2} fill="none" stroke="currentColor" strokeWidth={1.5} />
      <path d="M5 13V7l2.5 3L10 7v6M13 10l2 -3 2 3M15 7v6" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
};

export function renderToolIcon(icon: string, className?: string): React.ReactNode {
  const renderer = ICON_MAP[icon];
  if (renderer) {
    return <span className={className || "tool-icon"}>{renderer()}</span>;
  }
  // Fallback for unknown icons
  return <span className={className || "tool-icon"}>{icon}</span>;
}

export const ERASER_MODES: { mode: EraserMode; label: string; icon: string }[] = [
  { mode: "stroke", label: "划擦", icon: "〰" },
  { mode: "area", label: "框选擦除", icon: "▭" },
];
