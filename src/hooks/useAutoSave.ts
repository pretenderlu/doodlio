import { useEffect, useRef } from "react";
import type { WhiteboardElement } from "../types/elements";
import type { SlideItem } from "./useSlides";
import type { Viewport } from "../types/viewport";

const STORAGE_KEY = "wb-autosave";
const DEBOUNCE_MS = 2000; // Save 2 seconds after last change

interface AutoSaveData {
  elements: WhiteboardElement[];
  slides: SlideItem[];
  viewport?: Viewport;
  savedAt: number;
}

/**
 * Auto-saves whiteboard state to localStorage with debouncing.
 */
export function useAutoSave(
  elements: WhiteboardElement[],
  slides: SlideItem[],
  viewport: Viewport
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Skip the very first render (initial empty state or restored state)
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }

    // Debounce: clear previous timer, set a new one
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        // Clean elements: remove _roughDrawable and deleted elements
        const visible = elements.filter((el) => !el.isDeleted);
        const cleanElements = visible.map((el) => {
          const { _roughDrawable, ...rest } = el;
          return rest;
        });
        const cleanSlides = slides.map((s) => ({
          ...s,
          elements: s.elements.map((el) => {
            const { _roughDrawable, ...rest } = el;
            return rest;
          }),
        }));

        const data: AutoSaveData = {
          elements: cleanElements,
          slides: cleanSlides,
          viewport,
          savedAt: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // localStorage quota exceeded or other error — silently ignore
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timerRef.current);
  }, [elements, slides]);
}

/**
 * Load auto-saved data from localStorage.
 * Returns null if no saved data exists.
 */
export function loadAutoSave(): AutoSaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AutoSaveData;
    if (data && Array.isArray(data.elements)) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

/** Clear auto-saved data (e.g. when user explicitly creates a new project). */
export function clearAutoSave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}
