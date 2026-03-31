import { useCallback, useRef, useState } from "react";
import type { SlideItem } from "../hooks/useSlides";

interface SlidesPanelProps {
  slides: SlideItem[];
  currentIndex: number;
  slidesEnabled: boolean;
  onToggle: (v: boolean) => void;
  onSaveAsSlide: () => void;
  onUpdateCurrentSlide: () => void;
  onAddSlides: (files: FileList) => void;
  onRemoveSlide: (index: number) => void;
  onClearSlides: () => void;
  onGoToSlide: (index: number) => void;
  onAddBlankSlide: () => void;
  onRenameSlide: (index: number, name: string) => void;
  onReorderSlide: (fromIndex: number, toIndex: number) => void;
}

export function SlidesPanel({
  slides,
  currentIndex,
  slidesEnabled,
  onToggle,
  onSaveAsSlide,
  onUpdateCurrentSlide,
  onAddSlides,
  onRemoveSlide,
  onClearSlides,
  onGoToSlide,
  onAddBlankSlide,
  onRenameSlide,
  onReorderSlide,
}: SlidesPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onAddSlides(e.target.files);
      }
      e.target.value = "";
    },
    [onAddSlides]
  );

  // Double-click to rename
  const startRename = useCallback((index: number, currentName: string) => {
    setEditingIndex(index);
    setEditingName(currentName);
  }, []);

  const commitRename = useCallback(() => {
    if (editingIndex !== null && editingName.trim()) {
      onRenameSlide(editingIndex, editingName.trim());
    }
    setEditingIndex(null);
    setEditingName("");
  }, [editingIndex, editingName, onRenameSlide]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      setEditingIndex(null);
      setEditingName("");
    }
  }, [commitRename]);

  // Drag reorder handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Set a transparent drag image
    const el = e.currentTarget as HTMLElement;
    e.dataTransfer.setDragImage(el, el.offsetWidth / 2, 20);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragIndex !== null && dragIndex !== index) {
      setDropTarget(index);
    }
  }, [dragIndex]);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== toIndex) {
      onReorderSlide(dragIndex, toIndex);
    }
    setDragIndex(null);
    setDropTarget(null);
  }, [dragIndex, onReorderSlide]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropTarget(null);
  }, []);

  return (
    <div className="slides-panel">
      <div className="slides-panel-header">
        <span className="slides-panel-title">幻灯片</span>
        <div className="slides-panel-header-right">
          <label className="toggle-switch toggle-switch-sm">
            <input
              type="checkbox"
              checked={slidesEnabled}
              onChange={(e) => onToggle(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      <div className="slides-panel-body">
        {slides.length === 0 ? (
          <div className="slides-panel-empty">
            <p>暂无幻灯片</p>
            <p className="slides-panel-hint">当前画板内容可保存为幻灯片</p>
          </div>
        ) : (
          <>
            <div className="slides-panel-counter">
              {currentIndex + 1} / {slides.length}
            </div>
            <div className="slides-panel-list">
              {slides.map((slide, i) => (
                <div
                  key={slide.id}
                  className={`slides-panel-thumb${i === currentIndex ? " active" : ""}${dragIndex === i ? " dragging" : ""}${dropTarget === i ? " drop-target" : ""}`}
                  onClick={() => onGoToSlide(i)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, i)}
                  onDragEnd={handleDragEnd}
                >
                  <img src={slide.thumbnailUrl} alt={slide.name} />
                  <span className="slides-panel-thumb-index">{i + 1}</span>
                  {i === currentIndex && (
                    <span className="slides-panel-editing-badge">编辑中</span>
                  )}
                  {editingIndex === i ? (
                    <input
                      className="slides-panel-rename-input"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={handleRenameKeyDown}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="slides-panel-thumb-name"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startRename(i, slide.name);
                      }}
                      title="双击重命名"
                    >
                      {slide.name}
                    </span>
                  )}
                  <button
                    className="slides-panel-thumb-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveSlide(i);
                    }}
                    title="删除"
                  >
                    <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round"><line x1="2" y1="2" x2="8" y2="8" /><line x1="8" y1="2" x2="2" y2="8" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="slides-panel-footer">
        <div className="slides-panel-footer-row">
          <button
            className="slides-panel-btn slides-panel-save"
            onClick={onSaveAsSlide}
            title="将当前画板内容保存为一页新幻灯片"
          >
            <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"><path d="M12.5 14H3.5a1 1 0 01-1-1V3a1 1 0 011-1h7l3 3v8a1 1 0 01-1 1z" /><path d="M11 14V9H5v5" /><path d="M5 2v3h5" /></svg> 存为新页
          </button>
          <button
            className="slides-panel-btn slides-panel-new"
            onClick={onAddBlankSlide}
            title="新建一页空白幻灯片"
          >
            <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round"><line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" /></svg> 新建空白页
          </button>
        </div>
        <div className="slides-panel-footer-row">
          <button
            className="slides-panel-btn slides-panel-update"
            onClick={onUpdateCurrentSlide}
            disabled={slides.length === 0 || currentIndex < 0}
            title="将当前画板修改保存到此页幻灯片"
          >
            <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"><path d="M13 8a5 5 0 01-9.3 2.5" /><path d="M3 8a5 5 0 019.3-2.5" /><polyline points="13 3 13 6.5 9.5 6.5" /><polyline points="3 13 3 9.5 6.5 9.5" /></svg> 保存修改
          </button>
          <button
            className="slides-panel-btn slides-panel-import"
            onClick={handleImport}
            title="导入图片为幻灯片"
          >
            <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="12" height="10" rx="1" /><circle cx="5.5" cy="6.5" r="1" /><path d="M14 10l-3-3-5 5" /></svg> 导入图片
          </button>
          <button
            className="slides-panel-btn slides-panel-clear"
            onClick={onClearSlides}
            disabled={slides.length === 0}
            title="清空所有幻灯片"
          >
            <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h12" /><path d="M5 4V2.5A.5.5 0 015.5 2h5a.5.5 0 01.5.5V4" /><path d="M12.5 4l-.7 9.1a1 1 0 01-1 .9H5.2a1 1 0 01-1-.9L3.5 4" /></svg> 清空
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handleFiles}
      />

      <div className="slides-panel-shortcut-hint">
        <kbd>PageUp</kbd> 上一张 · <kbd>PageDown</kbd> 下一张
      </div>
    </div>
  );
}
