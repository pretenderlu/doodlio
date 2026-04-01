import { useWhiteboard } from "../hooks/useElements";
import { getMindMapCascadeDeleteIds } from "../utils/mindmapHelpers";
import { useColorStore } from "../hooks/useColorStore";
import { ColorPickerButton } from "./ColorPickerButton";
import type { FillStyle, PenLineStyle } from "../types/elements";

const STROKE_COLORS = ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00", "#9c36b5"];
const FILL_COLORS = ["#fce4ec", "#d3f9d8", "#d0ebff", "#fff3bf", "#ffe8cc", "#f3d9fa"];
const STROKE_WIDTHS = [1, 2, 4];
const FILL_STYLE_VALUES: FillStyle[] = ["hachure", "cross-hatch", "solid"];
const DASH_VALUES: number[][] = [[], [12, 8], [2, 6]];
const ROUGHNESS_VALUES = [0, 1, 3];

const FONT_PRESETS = [
  { label: "默认无衬线", value: "sans-serif" },
  { label: "默认衬线", value: "serif" },
  { label: "等宽字体", value: "monospace" },
  { label: "思源黑体", value: "'Noto Sans SC', sans-serif" },
  { label: "思源宋体", value: "'Noto Serif SC', serif" },
  { label: "站酷快乐体", value: "'ZCOOL KuaiLe', sans-serif" },
  { label: "站酷小薇", value: "'ZCOOL XiaoWei', serif" },
  { label: "马善政楷", value: "'Ma Shan Zheng', cursive" },
  { label: "Inter", value: "'Inter', sans-serif" },
  { label: "手写体", value: "'Caveat', cursive" },
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64, 72, 96];

// ---- SVG icon helpers ----

function FillStyleIcon({ type, size = 22 }: { type: FillStyle; size?: number }) {
  const s = size;
  const p = 3; // padding
  if (type === "solid") {
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        <rect x={p} y={p} width={s - p * 2} height={s - p * 2} rx={2} fill="#555" />
      </svg>
    );
  }
  if (type === "cross-hatch") {
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        <rect x={p} y={p} width={s - p * 2} height={s - p * 2} rx={2} fill="none" stroke="#555" strokeWidth={1} />
        <line x1={p} y1={p + 4} x2={s - p - 4} y2={s - p} stroke="#555" strokeWidth={0.8} />
        <line x1={p + 4} y1={p} x2={s - p} y2={s - p - 4} stroke="#555" strokeWidth={0.8} />
        <line x1={p} y1={s - p - 4} x2={s - p - 4} y2={p} stroke="#555" strokeWidth={0.8} />
        <line x1={p + 4} y1={s - p} x2={s - p} y2={p + 4} stroke="#555" strokeWidth={0.8} />
      </svg>
    );
  }
  // hachure
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <rect x={p} y={p} width={s - p * 2} height={s - p * 2} rx={2} fill="none" stroke="#555" strokeWidth={1} />
      <line x1={p} y1={p + 5} x2={s - p - 5} y2={s - p} stroke="#555" strokeWidth={0.8} />
      <line x1={p + 5} y1={p} x2={s - p} y2={s - p - 5} stroke="#555" strokeWidth={0.8} />
    </svg>
  );
}

function DashIcon({ dash, size = 28 }: { dash: number[]; size?: number }) {
  const y = size / 2;
  if (dash.length === 0) {
    // solid
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <line x1={3} y1={y} x2={size - 3} y2={y} stroke="#555" strokeWidth={2} strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <line x1={3} y1={y} x2={size - 3} y2={y} stroke="#555" strokeWidth={2} strokeLinecap="round"
        strokeDasharray={dash.join(",")} />
    </svg>
  );
}

function RoughnessIcon({ roughness, size = 28 }: { roughness: number; size?: number }) {
  const y = size / 2;
  if (roughness === 0) {
    // architect — perfectly straight
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <line x1={3} y1={y} x2={size - 3} y2={y} stroke="#555" strokeWidth={1.5} />
      </svg>
    );
  }
  if (roughness <= 1) {
    // artist — slightly wavy
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path d={`M3,${y} Q8,${y - 2} 11,${y + 1} T${size - 8},${y - 1} T${size - 3},${y}`}
          fill="none" stroke="#555" strokeWidth={1.5} />
      </svg>
    );
  }
  // cartoonist — very wobbly
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <path d={`M3,${y + 1} Q6,${y - 4} 9,${y + 3} Q12,${y + 5} 15,${y - 3} Q18,${y - 5} 21,${y + 2} Q24,${y + 4} ${size - 3},${y - 1}`}
        fill="none" stroke="#555" strokeWidth={1.5} />
    </svg>
  );
}

function CornerIcon({ rounded, size = 22 }: { rounded: boolean; size?: number }) {
  const p = 4;
  if (rounded) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path d={`M${p},${size - p} L${p},${p + 5} Q${p},${p} ${p + 5},${p} L${size - p},${p}`}
          fill="none" stroke="#555" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <path d={`M${p},${size - p} L${p},${p} L${size - p},${p}`}
        fill="none" stroke="#555" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EraserModeIcon({ mode, size = 22 }: { mode: "stroke" | "area" | "pixel"; size?: number }) {
  if (mode === "area") {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect x={3} y={3} width={size - 6} height={size - 6} rx={2}
          fill="none" stroke="#555" strokeWidth={1.5} strokeDasharray="3,2" />
      </svg>
    );
  }
  if (mode === "pixel") {
    // Circle with eraser marks
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 3}
          fill="none" stroke="#555" strokeWidth={1.5} />
        <circle cx={size / 2} cy={size / 2} r={2} fill="#555" />
      </svg>
    );
  }
  // stroke — wavy brush
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <path d={`M3,${size / 2 + 2} Q7,${size / 2 - 4} 11,${size / 2 + 1} T${size - 3},${size / 2 - 2}`}
        fill="none" stroke="#555" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}

function LayerIcon({ direction, size = 18 }: { direction: "front" | "back" | "forward" | "backward"; size?: number }) {
  const p = 2;
  const s = size;
  switch (direction) {
    case "back":
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <rect x={p + 4} y={p} width={s - p * 2 - 4} height={s - p * 2 - 4} rx={1.5} fill="none" stroke="#999" strokeWidth={1} />
          <rect x={p} y={p + 4} width={s - p * 2 - 4} height={s - p * 2 - 4} rx={1.5} fill="#555" stroke="#555" strokeWidth={1} />
        </svg>
      );
    case "backward":
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <rect x={p + 2} y={p} width={s - p * 2 - 2} height={s - p * 2 - 4} rx={1.5} fill="none" stroke="#999" strokeWidth={1} />
          <rect x={p} y={p + 4} width={s - p * 2 - 2} height={s - p * 2 - 4} rx={1.5} fill="#555" stroke="#555" strokeWidth={1} />
        </svg>
      );
    case "forward":
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <rect x={p} y={p + 4} width={s - p * 2 - 2} height={s - p * 2 - 4} rx={1.5} fill="none" stroke="#999" strokeWidth={1} />
          <rect x={p + 2} y={p} width={s - p * 2 - 2} height={s - p * 2 - 4} rx={1.5} fill="#555" stroke="#555" strokeWidth={1} />
        </svg>
      );
    case "front":
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <rect x={p} y={p + 4} width={s - p * 2 - 4} height={s - p * 2 - 4} rx={1.5} fill="none" stroke="#999" strokeWidth={1} />
          <rect x={p + 4} y={p} width={s - p * 2 - 4} height={s - p * 2 - 4} rx={1.5} fill="#555" stroke="#555" strokeWidth={1} />
        </svg>
      );
  }
}

// ---- Determine which tools use roughjs (support dash / roughness) ----
const ROUGH_TOOLS = ["line", "rectangle", "ellipse", "arrow", "mindmap"];
const ROUGH_TYPES = ["line", "rectangle", "ellipse", "arrow", "mindmap-node", "mindmap-edge"];

export function PropertiesPanel({ collapsed, style }: { collapsed?: boolean; style?: React.CSSProperties }) {
  const { state, dispatch, setStyle, setEraserMode, setEraserSize, setLaserDuration, setPenLineStyle, reorderElement, duplicateElement } = useWhiteboard();
  const { activeTool, activeStyle, selectedElementIds, elements, eraserMode, eraserSize, laserDuration } = state;

  const selectedEls = selectedElementIds
    .map((id) => elements.find((e) => e.id === id && !e.isDeleted))
    .filter(Boolean) as import("../types/elements").WhiteboardElement[];

  const selectedEl = selectedEls.length === 1 ? selectedEls[0] : null;

  const isDrawing = ["pen", "highlighter", "line", "rectangle", "ellipse", "arrow", "text", "mindmap"].includes(activeTool);
  const isShape = ["rectangle", "ellipse", "mindmap"].includes(activeTool);
  const isRoughTool = ROUGH_TOOLS.includes(activeTool);
  const isEraser = activeTool === "eraser";
  const isLaser = activeTool === "laser";
  const isText = activeTool === "text";
  const hasSelection = selectedEls.length > 0;
  const hasSingleSelection = selectedEls.length === 1;
  const selectedIsShape = hasSingleSelection && selectedEl && ["rectangle", "ellipse", "mindmap-node"].includes(selectedEl.type);
  const selectedIsRect = hasSingleSelection && selectedEl?.type === "rectangle";
  const selectedIsRough = hasSingleSelection && selectedEl && ROUGH_TYPES.includes(selectedEl.type);
  const selectedIsText = hasSingleSelection && selectedEl?.type === "text";
  const selectedIsMindmapNode = hasSingleSelection && selectedEl?.type === "mindmap-node";
  const isTextContext = isText || selectedIsText;
  const isMindmap = activeTool === "mindmap";
  const isPen = activeTool === "pen";
  const selectedIsPen = hasSingleSelection && selectedEl?.type === "pen" && !(selectedEl as import("../types/elements").PenElement).highlighter;
  const isPenContext = isPen || selectedIsPen;
  const penLineStyle: PenLineStyle = selectedIsPen
    ? ((selectedEl as import("../types/elements").PenElement).lineStyle || "default")
    : state.penLineStyle;
  const isPenSketchy = penLineStyle === "sketchy";

  // Text border state — works for both text tool active and selected text element
  const textEl = selectedIsText ? (selectedEl as import("../types/elements").TextElement) : null;
  const textHasBorder = selectedIsText ? (textEl?.showBorder === true) : (isText ? state.textShowBorder : false);
  // Show shape-like controls for text with border (tool or selection)
  const showTextBorderControls = (selectedIsText && textHasBorder) || (isText && textHasBorder);

  const colorStore = useColorStore();

  const showPanel = isDrawing || isEraser || isLaser || hasSelection;
  if (!showPanel) return null;

  const currentStyle = hasSingleSelection && selectedEl ? selectedEl.style : activeStyle;

  const setStyleProp = (key: string, value: unknown) => {
    setStyle({ [key]: value });
    if (selectedEls.length > 0) {
      const updates = selectedEls.map((el) => ({
        id: el.id,
        updates: { style: { ...el.style, [key]: value }, _roughDrawable: undefined },
      }));
      dispatch({ type: "UPDATE_ELEMENTS", updates });
    }
  };

  const hasFill = currentStyle.fillColor !== "transparent";
  const isRect = isShape || selectedIsRect;
  const showDashAndRoughness = isRoughTool || selectedIsRough || isPenSketchy;

  return (
    <div className={`props-panel${collapsed ? ' props-panel-collapsed' : ''}`} style={style}>
      {/* Text border toggle */}
      {isTextContext && (
        <div className="props-section">
          <div className="props-label">边框</div>
          <div className="props-btn-row">
            <button
              className={`props-icon-btn wide ${!textHasBorder ? "active" : ""}`}
              onClick={() => {
                if (selectedIsText && selectedEl) {
                  dispatch({
                    type: "UPDATE_ELEMENT",
                    id: selectedEl.id,
                    updates: { showBorder: false, _roughDrawable: undefined } as Partial<import("../types/elements").WhiteboardElement>,
                  });
                }
                if (isText) {
                  dispatch({ type: "SET_TEXT_STYLE", showBorder: false });
                }
              }}
              title="无边框"
            >
              <svg width={22} height={22} viewBox="0 0 22 22">
                <text x={4} y={16} fontSize={14} fill="#555" fontFamily="sans-serif">A</text>
              </svg>
              <span className="props-icon-label">无</span>
            </button>
            <button
              className={`props-icon-btn wide ${textHasBorder ? "active" : ""}`}
              onClick={() => {
                if (selectedIsText && selectedEl) {
                  dispatch({
                    type: "UPDATE_ELEMENT",
                    id: selectedEl.id,
                    updates: { showBorder: true, _roughDrawable: undefined } as Partial<import("../types/elements").WhiteboardElement>,
                  });
                }
                if (isText) {
                  dispatch({ type: "SET_TEXT_STYLE", showBorder: true });
                }
              }}
              title="显示边框"
            >
              <svg width={22} height={22} viewBox="0 0 22 22">
                <rect x={2} y={2} width={18} height={18} rx={2} fill="none" stroke="#555" strokeWidth={1.5} />
                <text x={5} y={16} fontSize={12} fill="#555" fontFamily="sans-serif">A</text>
              </svg>
              <span className="props-icon-label">边框</span>
            </button>
          </div>
        </div>
      )}

      {/* Pen line style toggle */}
      {isPenContext && (
        <div className="props-section">
          <div className="props-label">线条风格</div>
          <div className="props-btn-row">
            <button
              className={`props-icon-btn wide ${penLineStyle === "default" ? "active" : ""}`}
              onClick={() => {
                setPenLineStyle("default");
                if (selectedIsPen && selectedEl) {
                  dispatch({
                    type: "UPDATE_ELEMENT",
                    id: selectedEl.id,
                    updates: { lineStyle: "default", _roughDrawable: undefined } as Partial<import("../types/elements").WhiteboardElement>,
                  });
                }
              }}
              title="默认平滑笔画"
            >
              <svg width={22} height={22} viewBox="0 0 22 22">
                <path d="M3,16 Q6,4 11,11 T19,6" fill="none" stroke="#555" strokeWidth={2} strokeLinecap="round" />
              </svg>
              <span className="props-icon-label">默认</span>
            </button>
            <button
              className={`props-icon-btn wide ${penLineStyle === "sketchy" ? "active" : ""}`}
              onClick={() => {
                setPenLineStyle("sketchy");
                if (selectedIsPen && selectedEl) {
                  dispatch({
                    type: "UPDATE_ELEMENT",
                    id: selectedEl.id,
                    updates: { lineStyle: "sketchy", _roughDrawable: undefined } as Partial<import("../types/elements").WhiteboardElement>,
                  });
                }
              }}
              title="涂鸦手绘风格"
            >
              <svg width={22} height={22} viewBox="0 0 22 22">
                <path d="M3,15 Q5,6 8,12 Q10,17 12,9 Q14,3 16,10 Q18,15 19,7" fill="none" stroke="#555" strokeWidth={1.8} strokeLinecap="round" />
                <path d="M3,16 Q5,7 8,13 Q10,18 12,10 Q14,4 16,11 Q18,16 19,8" fill="none" stroke="#555" strokeWidth={0.8} strokeLinecap="round" opacity={0.4} />
              </svg>
              <span className="props-icon-label">涂鸦</span>
            </button>
          </div>
        </div>
      )}

      {/* 1. Stroke color / Font color */}
      {(isDrawing || hasSelection) && (
        <div className="props-section">
          <div className="props-label">
            {showTextBorderControls ? "边框颜色" : isTextContext ? "字体颜色" : selectedIsMindmapNode ? "边框颜色" : "描边"}
          </div>
          <div className="props-color-row">
            {STROKE_COLORS.map((c) => (
              <button
                key={c}
                className={`props-swatch ${currentStyle.strokeColor === c ? "active" : ""}`}
                style={{ background: c }}
                onClick={() => setStyleProp("strokeColor", c)}
                onContextMenu={(e) => { e.preventDefault(); colorStore.toggleFavorite(c); }}
              />
            ))}
            {colorStore.favoriteColors
              .filter((c) => !STROKE_COLORS.includes(c))
              .map((c) => (
                <div key={`fav-${c}`} className="props-swatch-wrap">
                  <button
                    className={`props-swatch ${currentStyle.strokeColor === c ? "active" : ""}`}
                    style={{ background: c }}
                    onClick={() => setStyleProp("strokeColor", c)}
                    onContextMenu={(e) => { e.preventDefault(); colorStore.toggleFavorite(c); }}
                  />
                  <span className="props-swatch-star">★</span>
                </div>
              ))}
            <ColorPickerButton
              currentColor={currentStyle.strokeColor}
              onChange={(c) => setStyleProp("strokeColor", c)}
              onCommit={(c) => colorStore.addRecentStroke(c)}
            />
          </div>
          {colorStore.recentStrokeColors.length > 0 && (
            <div className="props-color-extra-row">
              <span className="props-mini-label">近期</span>
              {colorStore.recentStrokeColors.map((c) => (
                <button
                  key={`recent-${c}`}
                  className={`props-mini-swatch ${currentStyle.strokeColor === c ? "active" : ""}`}
                  style={{ background: c }}
                  onClick={() => setStyleProp("strokeColor", c)}
                  onContextMenu={(e) => { e.preventDefault(); colorStore.toggleFavorite(c); }}
                  title={`${c}${colorStore.isFavorite(c) ? " ★" : ""} (右键收藏)`}
                />
              ))}
              <button className="props-mini-clear" onClick={() => colorStore.clearRecentStroke()} title="清空近期">✕</button>
            </div>
          )}
        </div>
      )}

      {/* Font color for text with border (separate from border color) */}
      {showTextBorderControls && (
        <div className="props-section">
          <div className="props-label">字体颜色</div>
          <div className="props-color-row">
            {STROKE_COLORS.map((c) => {
              const currentFontColor = selectedIsText
                ? (textEl?.fontColor || textEl?.style.strokeColor || "#1e1e1e")
                : state.textFontColor;
              return (
                <button
                  key={c}
                  className={`props-swatch ${currentFontColor === c ? "active" : ""}`}
                  style={{ background: c }}
                  onClick={() => {
                    if (selectedIsText && selectedEl) {
                      dispatch({
                        type: "UPDATE_ELEMENT",
                        id: selectedEl.id,
                        updates: { fontColor: c } as Partial<import("../types/elements").WhiteboardElement>,
                      });
                    }
                    if (isText) {
                      dispatch({ type: "SET_TEXT_STYLE", fontColor: c });
                    }
                  }}
                />
              );
            })}
            <ColorPickerButton
              currentColor={selectedIsText
                ? (textEl?.fontColor || textEl?.style.strokeColor || "#1e1e1e")
                : state.textFontColor}
              onChange={(c) => {
                if (selectedIsText && selectedEl) {
                  dispatch({
                    type: "UPDATE_ELEMENT",
                    id: selectedEl.id,
                    updates: { fontColor: c } as Partial<import("../types/elements").WhiteboardElement>,
                  });
                }
                if (isText) {
                  dispatch({ type: "SET_TEXT_STYLE", fontColor: c });
                }
              }}
              onCommit={(c) => colorStore.addRecentStroke(c)}
            />
          </div>
        </div>
      )}

      {/* 2. Fill color */}
      {(isShape || selectedIsShape || showTextBorderControls) && (
        <div className="props-section">
          <div className="props-label">背景</div>
          <div className="props-color-row">
            <button
              className={`props-swatch props-transparent ${currentStyle.fillColor === "transparent" ? "active" : ""}`}
              onClick={() => setStyleProp("fillColor", "transparent")}
              title="透明"
            />
            {FILL_COLORS.map((c) => (
              <button
                key={c}
                className={`props-swatch ${currentStyle.fillColor === c ? "active" : ""}`}
                style={{ background: c }}
                onClick={() => setStyleProp("fillColor", c)}
              />
            ))}
            <ColorPickerButton
              currentColor={currentStyle.fillColor === "transparent" ? "#ffffff" : currentStyle.fillColor}
              onChange={(c) => setStyleProp("fillColor", c)}
              onCommit={(c) => colorStore.addRecentFill(c)}
            />
          </div>
          {colorStore.recentFillColors.length > 0 && (
            <div className="props-color-extra-row">
              <span className="props-mini-label">近期</span>
              {colorStore.recentFillColors.map((c) => (
                <button
                  key={`recent-fill-${c}`}
                  className={`props-mini-swatch ${currentStyle.fillColor === c ? "active" : ""}`}
                  style={{ background: c }}
                  onClick={() => setStyleProp("fillColor", c)}
                  title={c}
                />
              ))}
              <button className="props-mini-clear" onClick={() => colorStore.clearRecentFill()} title="清空近期">✕</button>
            </div>
          )}
        </div>
      )}

      {/* 3. Fill style — only when fill is not transparent */}
      {(isShape || selectedIsShape || showTextBorderControls) && hasFill && (
        <div className="props-section">
          <div className="props-label">填充</div>
          <div className="props-btn-row">
            {FILL_STYLE_VALUES.map((fs) => (
              <button
                key={fs}
                className={`props-icon-btn ${(currentStyle.fillStyle || "hachure") === fs ? "active" : ""}`}
                onClick={() => setStyleProp("fillStyle", fs)}
                title={fs === "hachure" ? "斜线" : fs === "cross-hatch" ? "交叉线" : "实心"}
              >
                <FillStyleIcon type={fs} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Stroke width — 3 tiers (hidden for text without border) */}
      {((isDrawing || hasSelection) && !isTextContext) || showTextBorderControls ? (
        <div className="props-section">
          <div className="props-label">描边宽度</div>
          <div className="props-btn-row">
            {STROKE_WIDTHS.map((w) => (
              <button
                key={w}
                className={`props-icon-btn ${currentStyle.strokeWidth === w ? "active" : ""}`}
                onClick={() => {
                  setStyleProp("strokeWidth", w);
                  // Clear cached drawable so border redraws with new width
                  if (showTextBorderControls && selectedEl) {
                    dispatch({
                      type: "UPDATE_ELEMENT",
                      id: selectedEl.id,
                      updates: { _roughDrawable: undefined } as Partial<import("../types/elements").WhiteboardElement>,
                    });
                  }
                }}
                title={`${w}px`}
              >
                <svg width={28} height={28} viewBox="0 0 28 28">
                  <line x1={4} y1={14} x2={24} y2={14}
                    stroke="currentColor" strokeWidth={Math.max(1.5, w)} strokeLinecap="round" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Font family & size — text tool or selected text */}
      {isTextContext && (
        <div className="props-section">
          <div className="props-label">字体</div>
          <select
            className="props-font-select"
            value={isText ? state.textFontFamily : (selectedEl as import("../types/elements").TextElement)?.fontFamily || "sans-serif"}
            onChange={(e) => {
              const family = e.target.value;
              if (isText) {
                dispatch({ type: "SET_TEXT_STYLE", fontFamily: family });
              }
              if (selectedIsText && selectedEl) {
                const textEl = selectedEl as import("../types/elements").TextElement;
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                let width = 0;
                const lines = textEl.textContent.split("\n");
                if (ctx) {
                  ctx.font = `${textEl.fontSize}px ${family}`;
                  for (const line of lines) width = Math.max(width, ctx.measureText(line).width);
                }
                dispatch({
                  type: "UPDATE_ELEMENT",
                  id: selectedEl.id,
                  updates: { fontFamily: family, width } as Partial<import("../types/elements").WhiteboardElement>,
                });
              }
            }}
            style={{ fontFamily: isText ? state.textFontFamily : (selectedEl as import("../types/elements").TextElement)?.fontFamily }}
          >
            {FONT_PRESETS.map((f) => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {isTextContext && (
        <div className="props-section">
          <div className="props-label">字号</div>
          <select
            className="props-font-select props-font-size"
            value={isText ? state.textFontSize : (selectedEl as import("../types/elements").TextElement)?.fontSize || 20}
            onChange={(e) => {
              const size = Number(e.target.value);
              if (isText) {
                dispatch({ type: "SET_TEXT_STYLE", fontSize: size });
              }
              if (selectedIsText && selectedEl) {
                const textEl = selectedEl as import("../types/elements").TextElement;
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                let width = 0;
                const lines = textEl.textContent.split("\n");
                if (ctx) {
                  ctx.font = `${size}px ${textEl.fontFamily}`;
                  for (const line of lines) width = Math.max(width, ctx.measureText(line).width);
                }
                const height = lines.length * size * 1.2;
                dispatch({
                  type: "UPDATE_ELEMENT",
                  id: selectedEl.id,
                  updates: { fontSize: size, width, height } as Partial<import("../types/elements").WhiteboardElement>,
                });
              }
            }}
          >
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>{s}px</option>
            ))}
          </select>
        </div>
      )}

      {/* Font for mindmap nodes */}
      {(selectedIsMindmapNode || isMindmap) && (
        <div className="props-section">
          <div className="props-label">字体</div>
          <select
            className="props-font-select"
            value={selectedIsMindmapNode ? (selectedEl as import("../types/elements").MindMapNodeElement).fontFamily || "sans-serif" : "sans-serif"}
            onChange={(e) => {
              const family = e.target.value;
              if (selectedIsMindmapNode && selectedEl) {
                dispatch({
                  type: "UPDATE_ELEMENT",
                  id: selectedEl.id,
                  updates: { fontFamily: family } as Partial<import("../types/elements").WhiteboardElement>,
                });
              }
            }}
            style={{ fontFamily: selectedIsMindmapNode ? (selectedEl as import("../types/elements").MindMapNodeElement).fontFamily : "sans-serif" }}
          >
            {FONT_PRESETS.map((f) => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {(selectedIsMindmapNode || isMindmap) && (
        <div className="props-section">
          <div className="props-label">字号</div>
          <select
            className="props-font-select props-font-size"
            value={selectedIsMindmapNode ? (selectedEl as import("../types/elements").MindMapNodeElement).fontSize || 16 : 16}
            onChange={(e) => {
              const size = Number(e.target.value);
              if (selectedIsMindmapNode && selectedEl) {
                dispatch({
                  type: "UPDATE_ELEMENT",
                  id: selectedEl.id,
                  updates: { fontSize: size } as Partial<import("../types/elements").WhiteboardElement>,
                });
              }
            }}
          >
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>{s}px</option>
            ))}
          </select>
        </div>
      )}

      {(selectedIsMindmapNode || isMindmap) && (
        <div className="props-section">
          <div className="props-label">字体颜色</div>
          <div className="props-color-row">
            {["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00", "#9c36b5", "#ffffff", "#868e96"].map((c) => (
              <button
                key={c}
                className={`props-swatch ${
                  (selectedIsMindmapNode && ((selectedEl as import("../types/elements").MindMapNodeElement).fontColor || "#333") === c) ? "active" : ""
                }`}
                style={{ background: c, border: c === "#ffffff" ? "1px solid #ccc" : undefined }}
                onClick={() => {
                  if (selectedIsMindmapNode && selectedEl) {
                    dispatch({
                      type: "UPDATE_ELEMENT",
                      id: selectedEl.id,
                      updates: { fontColor: c } as Partial<import("../types/elements").WhiteboardElement>,
                    });
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 5. Border style (dash) — for roughjs tools + text with border */}
      {(showDashAndRoughness || showTextBorderControls) && (
        <div className="props-section">
          <div className="props-label">{(isPenContext || activeTool === "line" || activeTool === "arrow" || (hasSingleSelection && selectedEl && ["pen", "line", "arrow"].includes(selectedEl.type))) ? "线条样式" : "边框样式"}</div>
          <div className="props-btn-row">
            {DASH_VALUES.map((d, i) => {
              const currentDash = currentStyle.strokeDasharray || [];
              const isActive = d.length === currentDash.length && d.every((v, j) => v === currentDash[j]);
              return (
                <button
                  key={i}
                  className={`props-icon-btn ${isActive ? "active" : ""}`}
                  onClick={() => {
                    setStyleProp("strokeDasharray", d);
                    if (showTextBorderControls && selectedEl) {
                      dispatch({ type: "UPDATE_ELEMENT", id: selectedEl.id, updates: { _roughDrawable: undefined } as Partial<import("../types/elements").WhiteboardElement> });
                    }
                  }}
                  title={d.length === 0 ? "实线" : d[0] > 4 ? "虚线" : "点线"}
                >
                  <DashIcon dash={d} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Line style (roughness) — for roughjs tools + text with border */}
      {(showDashAndRoughness || showTextBorderControls) && (
        <div className="props-section">
          <div className="props-label">线条风格</div>
          <div className="props-btn-row">
            {ROUGHNESS_VALUES.map((r) => (
              <button
                key={r}
                className={`props-icon-btn ${currentStyle.roughness === r ? "active" : ""}`}
                onClick={() => {
                  setStyleProp("roughness", r);
                  if (showTextBorderControls && selectedEl) {
                    dispatch({ type: "UPDATE_ELEMENT", id: selectedEl.id, updates: { _roughDrawable: undefined } as Partial<import("../types/elements").WhiteboardElement> });
                  }
                }}
                title={r === 0 ? "建筑师" : r === 1 ? "艺术家" : "漫画家"}
              >
                <RoughnessIcon roughness={r} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 7. Corner radius — rectangle or text with border */}
      {(isRect || showTextBorderControls) && (
        <div className="props-section">
          <div className="props-label">边角</div>
          <div className="props-btn-row">
            <button
              className={`props-icon-btn ${(currentStyle.cornerRadius || 0) === 0 ? "active" : ""}`}
              onClick={() => {
                setStyleProp("cornerRadius", 0);
                if (showTextBorderControls && selectedEl) {
                  dispatch({ type: "UPDATE_ELEMENT", id: selectedEl.id, updates: { _roughDrawable: undefined } as Partial<import("../types/elements").WhiteboardElement> });
                }
              }}
              title="直角"
            >
              <CornerIcon rounded={false} />
            </button>
            <button
              className={`props-icon-btn ${(currentStyle.cornerRadius || 0) > 0 ? "active" : ""}`}
              onClick={() => {
                setStyleProp("cornerRadius", 16);
                if (showTextBorderControls && selectedEl) {
                  dispatch({ type: "UPDATE_ELEMENT", id: selectedEl.id, updates: { _roughDrawable: undefined } as Partial<import("../types/elements").WhiteboardElement> });
                }
              }}
              title="圆角"
            >
              <CornerIcon rounded={true} />
            </button>
          </div>
        </div>
      )}

      {/* Old font-size slider removed — now handled by the dropdown above */}

      {/* 8. Opacity */}
      {(isDrawing || hasSelection) && (
        <div className="props-section">
          <div className="props-label">透明度</div>
          <input
            type="range"
            className="props-slider"
            min={0}
            max={100}
            value={Math.round(currentStyle.opacity * 100)}
            onChange={(e) => setStyleProp("opacity", Number(e.target.value) / 100)}
          />
          <div className="props-range-labels">
            <span>0</span>
            <span>100</span>
          </div>
        </div>
      )}

      {/* Eraser mode */}
      {isEraser && (
        <div className="props-section">
          <div className="props-label">橡皮模式</div>
          <div className="props-btn-row">
            <button
              className={`props-icon-btn wide ${eraserMode === "stroke" ? "active" : ""}`}
              onClick={() => setEraserMode("stroke")}
              title="涂抹"
            >
              <EraserModeIcon mode="stroke" />
              <span className="props-icon-label">涂抹</span>
            </button>
            <button
              className={`props-icon-btn wide ${eraserMode === "area" ? "active" : ""}`}
              onClick={() => setEraserMode("area")}
              title="框选"
            >
              <EraserModeIcon mode="area" />
              <span className="props-icon-label">框选</span>
            </button>
            <button
              className={`props-icon-btn wide ${eraserMode === "pixel" ? "active" : ""}`}
              onClick={() => setEraserMode("pixel")}
              title="像素"
            >
              <EraserModeIcon mode="pixel" />
              <span className="props-icon-label">像素</span>
            </button>
          </div>
        </div>
      )}

      {/* Pixel eraser size */}
      {isEraser && eraserMode === "pixel" && (
        <div className="props-section">
          <div className="props-label">笔刷大小: {eraserSize}px</div>
          <input
            type="range"
            className="props-slider"
            min={4}
            max={80}
            step={2}
            value={eraserSize}
            onChange={(e) => setEraserSize(Number(e.target.value))}
          />
          <div className="props-range-labels">
            <span>细</span>
            <span>粗</span>
          </div>
        </div>
      )}

      {/* Laser duration */}
      {isLaser && (
        <div className="props-section">
          <div className="props-label">拖尾时长: {(laserDuration / 1000).toFixed(1)}s</div>
          <input
            type="range"
            className="props-slider"
            min={300}
            max={5000}
            step={100}
            value={laserDuration}
            onChange={(e) => setLaserDuration(Number(e.target.value))}
          />
          <div className="props-range-labels">
            <span>短</span>
            <span>长</span>
          </div>
        </div>
      )}

      {/* 9. Layer order — single selected only */}
      {hasSingleSelection && selectedEl && (
        <div className="props-section">
          <div className="props-label">图层</div>
          <div className="props-btn-row props-layer-row">
            {(["back", "backward", "forward", "front"] as const).map((dir) => (
              <button
                key={dir}
                className="props-icon-btn"
                onClick={() => reorderElement(selectedEl.id, dir)}
                title={dir === "back" ? "置底" : dir === "backward" ? "下移" : dir === "forward" ? "上移" : "置顶"}
              >
                <LayerIcon direction={dir} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 10. Actions — selected only */}
      {hasSelection && (
        <div className="props-section">
          <div className="props-label">
            {selectedEls.length > 1 ? `选中 ${selectedEls.length} 个元素` : "操作"}
          </div>
          <div className="props-btn-row">
            {hasSingleSelection && selectedEl && (
              <button
                className="props-icon-btn wide"
                onClick={() => duplicateElement(selectedEl.id)}
                title="复制"
              >
                <svg width={16} height={16} viewBox="0 0 16 16">
                  <rect x={4} y={1} width={9} height={11} rx={1.5} fill="none" stroke="currentColor" strokeWidth={1.3} />
                  <rect x={2} y={4} width={9} height={11} rx={1.5} fill="none" stroke="currentColor" strokeWidth={1.3} />
                </svg>
                <span className="props-icon-label">复制</span>
              </button>
            )}
            <button
              className="props-icon-btn wide danger"
              onClick={() => {
                const allIdsToDelete: string[] = [];
                for (const el of selectedEls) {
                  if (el.type === "mindmap-node") {
                    const ids = getMindMapCascadeDeleteIds(el.id, elements);
                    for (const id of ids) {
                      if (!allIdsToDelete.includes(id)) allIdsToDelete.push(id);
                    }
                  } else {
                    if (!allIdsToDelete.includes(el.id)) allIdsToDelete.push(el.id);
                  }
                }
                dispatch({ type: "DELETE_ELEMENTS", ids: allIdsToDelete });
              }}
              title="删除"
            >
              <svg width={16} height={16} viewBox="0 0 16 16">
                <path d="M3,4 L4,14 Q4,15 5,15 L11,15 Q12,15 12,14 L13,4" fill="none" stroke="currentColor" strokeWidth={1.3} />
                <line x1={2} y1={4} x2={14} y2={4} stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
                <path d="M6,4 L6,2.5 Q6,2 6.5,2 L9.5,2 Q10,2 10,2.5 L10,4" fill="none" stroke="currentColor" strokeWidth={1.2} />
              </svg>
              <span className="props-icon-label">删除</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
