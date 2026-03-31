import { useState, useRef, useEffect } from "react";
import { useWhiteboard } from "../hooks/useElements";
import { ColorPickerButton } from "./ColorPickerButton";

const CANVAS_BG_COLORS = [
  "#ffffff", "#f8f9fa", "#fff3bf", "#d3f9d8", "#d0ebff", "#f3d9fa", "#ffe8cc",
];

interface Props {
  canvasBg: string;
  onCanvasBgChange: (color: string) => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onExportImage: () => void;
  onExportSvg?: () => void;
}

export function HamburgerMenu({ canvasBg, onCanvasBgChange, onOpenFile, onSaveFile, onExportImage, onExportSvg }: Props) {
  const [open, setOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { dispatch } = useWhiteboard();
  const hasVisibleElements = useWhiteboard().state.elements.some((el) => !el.isDeleted);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleClear = () => {
    setOpen(false);
    if (hasVisibleElements) dispatch({ type: "CLEAR_ALL" });
  };

  return (
    <div className="hamburger-wrap" ref={menuRef}>
      <button
        className="hamburger-btn"
        onClick={() => { setOpen(!open); setShowHelp(false); }}
        title="菜单"
      >
        <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <line x1="3" y1="4.5" x2="15" y2="4.5" />
          <line x1="3" y1="9" x2="15" y2="9" />
          <line x1="3" y1="13.5" x2="15" y2="13.5" />
        </svg>
      </button>
      {open && !showHelp && (
        <div className="hamburger-menu">
          <button className="hmenu-item" onClick={() => { setOpen(false); onOpenFile(); }}>
            <span className="hmenu-icon">
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="#555" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 13V3a1 1 0 011-1h4l2 2h4a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1z" />
              </svg>
            </span>
            <span className="hmenu-text">打开</span>
            <span className="hmenu-shortcut">Ctrl+O</span>
          </button>
          <button className="hmenu-item" onClick={() => { setOpen(false); onSaveFile(); }}>
            <span className="hmenu-icon">
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="#555" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.5 14H3.5a1 1 0 01-1-1V3a1 1 0 011-1h7l3 3v8a1 1 0 01-1 1z" />
                <path d="M11 14V9H5v5" />
                <path d="M5 2v3h5" />
              </svg>
            </span>
            <span className="hmenu-text">保存到...</span>
            <span className="hmenu-shortcut">Ctrl+S</span>
          </button>
          <button className="hmenu-item" onClick={() => { setOpen(false); onExportImage(); }}>
            <span className="hmenu-icon">
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="#555" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 10v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3" />
                <polyline points="8 2 8 10" />
                <polyline points="5 5 8 2 11 5" />
              </svg>
            </span>
            <span className="hmenu-text">导出图片...</span>
            <span className="hmenu-shortcut">Ctrl+Shift+E</span>
          </button>
          {onExportSvg && (
            <button className="hmenu-item" onClick={() => { setOpen(false); onExportSvg(); }}>
              <span className="hmenu-icon">
                <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="#555" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 10v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3" />
                  <polyline points="8 2 8 10" />
                  <polyline points="5 5 8 2 11 5" />
                </svg>
              </span>
              <span className="hmenu-text">导出 SVG...</span>
              <span className="hmenu-shortcut">Ctrl+Shift+S</span>
            </button>
          )}
          <button
            className="hmenu-item hmenu-danger"
            onClick={handleClear}
            disabled={!hasVisibleElements}
          >
            <span className="hmenu-icon">
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4h12" />
                <path d="M5 4V2.5A.5.5 0 015.5 2h5a.5.5 0 01.5.5V4" />
                <path d="M12.5 4l-.7 9.1a1 1 0 01-1 .9H5.2a1 1 0 01-1-.9L3.5 4" />
              </svg>
            </span>
            <span className="hmenu-text">重置画布</span>
          </button>
          <button className="hmenu-item" onClick={() => setShowHelp(true)}>
            <span className="hmenu-icon">
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="#555" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="6" />
                <path d="M6 6a2 2 0 013.5 1.5c0 1-1.5 1.5-1.5 1.5" />
                <circle cx="8" cy="11.5" r="0.5" fill="#555" stroke="none" />
              </svg>
            </span>
            <span className="hmenu-text">帮助</span>
            <span className="hmenu-shortcut">?</span>
          </button>
          <div className="hmenu-divider" />
          <div className="hmenu-label">画布背景</div>
          <div className="hmenu-bg-row">
            {CANVAS_BG_COLORS.map((c) => (
              <button
                key={c}
                className={`hmenu-bg-swatch ${canvasBg === c ? "active" : ""}`}
                style={{ background: c }}
                onClick={() => onCanvasBgChange(c)}
              />
            ))}
            <ColorPickerButton
              currentColor={CANVAS_BG_COLORS.includes(canvasBg) ? "#ffffff" : canvasBg}
              onChange={(c) => onCanvasBgChange(c)}
            />
          </div>
        </div>
      )}
      {open && showHelp && (
        <div className="hamburger-menu hamburger-help">
          <div className="hmenu-help-header">
            <button className="hmenu-back-btn" onClick={() => setShowHelp(false)}>
              <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 2 4 7 9 12" />
              </svg>
            </button>
            <span className="hmenu-help-title">快捷键</span>
          </div>
          <div className="hmenu-help-list">
            {[
              ["V / 1", "选择"],
              ["P / 2", "画笔"],
              ["H", "荧光笔"],
              ["G", "激光笔"],
              ["L / 3", "直线"],
              ["R / 4", "矩形"],
              ["O / 5", "椭圆"],
              ["A / 6", "箭头"],
              ["T / 7", "文字"],
              ["E / 8", "橡皮擦"],
              ["M / 9", "脑图"],
              ["Ctrl+Z", "撤销"],
              ["Ctrl+Shift+Z", "重做"],
              ["[ / ]", "描边宽度 -/+"],
              ["Delete", "删除选中"],
              ["Ctrl+O", "打开文件"],
              ["Ctrl+S", "保存"],
              ["Ctrl+Shift+E", "导出图片"],
              ["Ctrl+Shift+S", "导出 SVG"],
              ["Ctrl+C / V", "复制 / 粘贴"],
              ["Ctrl+D", "复制选中"],
              ["Ctrl+G", "分组"],
              ["Ctrl+Shift+G", "取消分组"],
            ].map(([key, desc]) => (
              <div key={key} className="hmenu-help-row">
                <kbd className="hmenu-kbd">{key}</kbd>
                <span>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
