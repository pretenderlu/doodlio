import { useState, useRef, useCallback } from "react";
import { nanoid } from "nanoid";
import { useWhiteboard } from "./useElements";
import { worldToScreen } from "../utils/coordinates";
import type { TextElement, WhiteboardElement } from "../types/elements";

export function useTextEditor() {
  const { state, dispatch } = useWhiteboard();
  const [isEditing, setIsEditing] = useState(false);
  const [editPos, setEditPos] = useState({ x: 0, y: 0 });
  const [_editingElementId, setEditingElementId] = useState<string | null>(null);
  // Live editing values (may differ from global state when editing existing element)
  const [editFontSize, setEditFontSize] = useState(20);
  const [editFontFamily, setEditFontFamily] = useState("sans-serif");
  const [editColor, setEditColor] = useState("#1e1e1e");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const commitPosRef = useRef({ x: 0, y: 0 });
  const committedRef = useRef(false);
  const isEditingRef = useRef(false);
  const editingIdRef = useRef<string | null>(null);
  const fontSizeRef = useRef(20);
  const fontFamilyRef = useRef("sans-serif");

  const doCommit = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;

    const text = textareaRef.current?.value.trim();
    if (!text) return;

    const fontSize = fontSizeRef.current;
    const fontFamily = fontFamilyRef.current;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    let width = 0;
    const lines = text.split("\n");

    if (ctx) {
      ctx.font = `${fontSize}px ${fontFamily}`;
      for (const line of lines) {
        const m = ctx.measureText(line);
        width = Math.max(width, m.width);
      }
    }

    const height = lines.length * fontSize * 1.2;
    const pos = commitPosRef.current;
    const editId = editingIdRef.current;

    if (editId) {
      dispatch({
        type: "UPDATE_ELEMENT",
        id: editId,
        updates: {
          textContent: text,
          width,
          height,
          fontSize,
          fontFamily,
        } as Partial<WhiteboardElement>,
      });
    } else {
      const maxZ = state.elements.reduce(
        (max, el) => (el.isDeleted ? max : Math.max(max, el.zIndex)),
        0
      );

      const el: TextElement = {
        id: nanoid(),
        type: "text",
        x: pos.x,
        y: pos.y,
        width,
        height,
        textContent: text,
        fontSize,
        fontFamily,
        showBorder: state.textShowBorder,
        fontColor: state.textShowBorder ? state.textFontColor : undefined,
        style: { ...state.activeStyle },
        roughSeed: Math.floor(Math.random() * 2 ** 31),
        isDeleted: false,
        zIndex: maxZ + 1,
      };

      dispatch({ type: "ADD_ELEMENT", element: el });
    }
  }, [state.activeStyle, state.elements, dispatch]);

  const startEditing = useCallback((x: number, y: number) => {
    if (isEditingRef.current) {
      doCommit();
      if (textareaRef.current) textareaRef.current.value = "";
    }

    // Read font settings from global state
    const font = state.textFontFamily;
    const size = state.textFontSize;

    committedRef.current = false;
    commitPosRef.current = { x, y };
    editingIdRef.current = null;
    fontSizeRef.current = size;
    fontFamilyRef.current = font;
    isEditingRef.current = true;

    setEditPos({ x, y });
    setEditingElementId(null);
    setEditFontSize(size);
    setEditFontFamily(font);
    setEditColor(state.activeStyle.strokeColor);
    setIsEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [state.activeStyle.strokeColor, state.textFontFamily, state.textFontSize, doCommit]);

  const startEditingExisting = useCallback((elementId: string) => {
    const el = state.elements.find(
      (e) => e.id === elementId && e.type === "text" && !e.isDeleted
    ) as TextElement | undefined;
    if (!el) return;

    if (isEditingRef.current) {
      doCommit();
      if (textareaRef.current) textareaRef.current.value = "";
    }

    committedRef.current = false;
    commitPosRef.current = { x: el.x, y: el.y };
    editingIdRef.current = elementId;
    fontSizeRef.current = el.fontSize;
    fontFamilyRef.current = el.fontFamily;
    isEditingRef.current = true;

    setEditPos({ x: el.x, y: el.y });
    setEditingElementId(elementId);
    setEditFontSize(el.fontSize);
    setEditFontFamily(el.fontFamily);
    setEditColor(el.style.strokeColor);
    setIsEditing(true);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.value = el.textContent;
        textareaRef.current.focus();
        textareaRef.current.select();
      }
    }, 0);
  }, [state.elements, doCommit]);

  const handleBlur = useCallback(() => {
    doCommit();
    isEditingRef.current = false;
    setIsEditing(false);
    setEditingElementId(null);
  }, [doCommit]);

  // Simple textarea — no inline toolbar (font selection is in the left toolbar)
  const textEditorUI = isEditing ? (() => {
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
        <textarea
          ref={textareaRef}
          className="text-editor"
          style={{
            fontSize: editFontSize,
            fontFamily: editFontFamily,
            color: editColor,
            background: "transparent",
            border: "1px dashed #4a90d9",
            outline: "none",
            resize: "both",
            minWidth: 150,
            minHeight: 40,
            padding: 4,
          }}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              committedRef.current = true;
              isEditingRef.current = false;
              setIsEditing(false);
              setEditingElementId(null);
            }
            e.stopPropagation();
          }}
        />
      </div>
    );
  })() : null;

  return { isEditing, startEditing, startEditingExisting, textEditorUI };
}
