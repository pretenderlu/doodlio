import { useState, useCallback, memo } from "react";
import { nanoid } from "nanoid";
import { useWhiteboard } from "../hooks/useElements";
import type { Layer, WhiteboardElement } from "../types/elements";
import "../styles/layer-panel.css";

const S = 14;
const P: React.SVGAttributes<SVGElement> = {
  fill: "none", stroke: "currentColor", strokeWidth: 1.5,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
};
function Ico({ children }: { children: React.ReactNode }) {
  return <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} {...P}>{children}</svg>;
}

const IconEyeOpen = () => (
  <Ico>
    <path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" />
    <circle cx={7} cy={7} r={1.5} />
  </Ico>
);
const IconEyeClosed = () => (
  <Ico>
    <path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" />
    <line x1={2} y1={12} x2={12} y2={2} />
  </Ico>
);
const IconLocked = () => (
  <Ico>
    <rect x={3} y={6} width={8} height={6} rx={1} />
    <path d="M5 6V4.5a2 2 0 014 0V6" />
  </Ico>
);
const IconUnlocked = () => (
  <Ico>
    <rect x={3} y={6} width={8} height={6} rx={1} />
    <path d="M5 6V4.5a2 2 0 014 0" />
  </Ico>
);

interface Props {
  onClose: () => void;
}

export const LayerPanel = memo(function LayerPanel({ onClose }: Props) {
  const { state, dispatch } = useWhiteboard();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const layers = [...state.layers].sort((a, b) => b.order - a.order); // top layers first

  const elementCountByLayer = new Map<string, number>();
  for (const el of state.elements) {
    if (el.isDeleted) continue;
    const lid = el.layerId || state.layers[0]?.id || "";
    elementCountByLayer.set(lid, (elementCountByLayer.get(lid) || 0) + 1);
  }

  const addLayer = useCallback(() => {
    const maxOrder = state.layers.reduce((m, l) => Math.max(m, l.order), 0);
    const newLayer: Layer = {
      id: nanoid(),
      name: `图层 ${state.layers.length + 1}`,
      visible: true,
      locked: false,
      order: maxOrder + 1,
    };
    dispatch({ type: "ADD_LAYER", layer: newLayer });
  }, [state.layers, dispatch]);

  const deleteLayer = useCallback((layerId: string) => {
    if (state.layers.length <= 1) return;
    dispatch({ type: "DELETE_LAYER", layerId });
  }, [state.layers.length, dispatch]);

  const toggleVisibility = useCallback((layer: Layer) => {
    const newVisible = !layer.visible;
    dispatch({ type: "UPDATE_LAYER", layerId: layer.id, updates: { visible: newVisible } });
    // Batch update all elements in this layer
    const updates = state.elements
      .filter((el) => !el.isDeleted && (el.layerId || state.layers[0]?.id) === layer.id)
      .map((el) => ({ id: el.id, updates: { isHidden: !newVisible } as Partial<WhiteboardElement> }));
    if (updates.length > 0) dispatch({ type: "UPDATE_ELEMENTS", updates });
  }, [state.elements, state.layers, dispatch]);

  const toggleLock = useCallback((layer: Layer) => {
    const newLocked = !layer.locked;
    dispatch({ type: "UPDATE_LAYER", layerId: layer.id, updates: { locked: newLocked } });
    const updates = state.elements
      .filter((el) => !el.isDeleted && (el.layerId || state.layers[0]?.id) === layer.id)
      .map((el) => ({ id: el.id, updates: { locked: newLocked } as Partial<WhiteboardElement> }));
    if (updates.length > 0) dispatch({ type: "UPDATE_ELEMENTS", updates });
  }, [state.elements, state.layers, dispatch]);

  const startRename = (layer: Layer) => {
    setEditingId(layer.id);
    setEditName(layer.name);
  };

  const finishRename = () => {
    if (editingId && editName.trim()) {
      dispatch({ type: "UPDATE_LAYER", layerId: editingId, updates: { name: editName.trim() } });
    }
    setEditingId(null);
  };

  return (
    <div className="layer-panel">
      <div className="layer-panel-header">
        <span className="layer-panel-title">图层</span>
        <div className="layer-panel-header-actions">
          <button className="layer-panel-add" onClick={addLayer} title="新建图层">+</button>
          <button className="layer-panel-close" onClick={onClose}>✕</button>
        </div>
      </div>
      <div className="layer-panel-list">
        {layers.map((layer) => {
          const isActive = state.activeLayerId === layer.id;
          const count = elementCountByLayer.get(layer.id) || 0;
          return (
            <div
              key={layer.id}
              className={`layer-item ${isActive ? "selected" : ""} ${!layer.visible ? "hidden-layer" : ""}`}
              onClick={() => dispatch({ type: "SET_ACTIVE_LAYER", layerId: layer.id })}
            >
              <div className="layer-item-main">
                {editingId === layer.id ? (
                  <input
                    className="layer-rename-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={finishRename}
                    onKeyDown={(e) => { if (e.key === "Enter") finishRename(); if (e.key === "Escape") setEditingId(null); }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="layer-item-name"
                    onDoubleClick={(e) => { e.stopPropagation(); startRename(layer); }}
                  >
                    {layer.name}
                  </span>
                )}
                <span className="layer-item-count">{count}</span>
              </div>
              <div className="layer-item-actions">
                <button
                  className={`layer-btn ${!layer.visible ? "active" : ""}`}
                  onClick={(e) => { e.stopPropagation(); toggleVisibility(layer); }}
                  title={layer.visible ? "隐藏" : "显示"}
                >
                  {layer.visible ? <IconEyeOpen /> : <IconEyeClosed />}
                </button>
                <button
                  className={`layer-btn ${layer.locked ? "active" : ""}`}
                  onClick={(e) => { e.stopPropagation(); toggleLock(layer); }}
                  title={layer.locked ? "解锁" : "锁定"}
                >
                  {layer.locked ? <IconLocked /> : <IconUnlocked />}
                </button>
                <button
                  className="layer-btn"
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: "REORDER_LAYER", layerId: layer.id, direction: "up" }); }}
                  title="上移"
                >↑</button>
                <button
                  className="layer-btn"
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: "REORDER_LAYER", layerId: layer.id, direction: "down" }); }}
                  title="下移"
                >↓</button>
                {state.layers.length > 1 && (
                  <button
                    className="layer-btn layer-btn-delete"
                    onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}
                    title="删除图层"
                  >✕</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
