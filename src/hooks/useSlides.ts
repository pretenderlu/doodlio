import { useState, useCallback, useRef } from "react";
import type { WhiteboardElement } from "../types/elements";
import { renderScene } from "../utils/renderer";

export interface SlideItem {
  id: string;
  name: string;
  elements: WhiteboardElement[]; // stored whiteboard elements (editable)
  thumbnailUrl: string;          // data URL rendered preview
}

interface SlidesState {
  slides: SlideItem[];
  currentIndex: number;  // -1 = no slide active (free canvas)
  enabled: boolean;
}

/** Deep-clone elements so stored slides are immune to external mutation */
function cloneElements(elements: WhiteboardElement[]): WhiteboardElement[] {
  return JSON.parse(JSON.stringify(
    elements.map((el) => ({ ...el, _roughDrawable: undefined }))
  ));
}

/** Generate a thumbnail by rendering elements centered in a small canvas */
function captureThumbnail(elements?: WhiteboardElement[]): string {
  const w = 320;
  const h = 180;
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const ctx = off.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  const visibleEls = elements?.filter((el) => !el.isDeleted) || [];
  if (visibleEls.length === 0) {
    const sourceCanvas = document.querySelector(".canvas-frame canvas:first-child") as HTMLCanvasElement | null;
    if (sourceCanvas && sourceCanvas.width > 0 && sourceCanvas.height > 0) {
      const scale = Math.min(w / sourceCanvas.width, h / sourceCanvas.height);
      const dw = sourceCanvas.width * scale;
      const dh = sourceCanvas.height * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      try { ctx.drawImage(sourceCanvas, dx, dy, dw, dh); } catch { /* ignore */ }
    }
    return off.toDataURL("image/png", 0.7);
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of visibleEls) {
    if ("points" in el && el.points && (el.type as string) !== "rectangle" && (el.type as string) !== "ellipse") {
      for (const [px, py] of el.points) {
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
    } else {
      const x1 = Math.min(el.x, el.x + el.width);
      const y1 = Math.min(el.y, el.y + el.height);
      const x2 = Math.max(el.x, el.x + el.width);
      const y2 = Math.max(el.y, el.y + el.height);
      minX = Math.min(minX, x1);
      minY = Math.min(minY, y1);
      maxX = Math.max(maxX, x2);
      maxY = Math.max(maxY, y2);
    }
  }

  const pad = 20;
  const bw = maxX - minX + pad * 2;
  const bh = maxY - minY + pad * 2;
  const zoom = Math.min(w / bw, h / bh, 2);
  const panX = -(minX - pad) * zoom + (w - bw * zoom) / 2;
  const panY = -(minY - pad) * zoom + (h - bh * zoom) / 2;

  renderScene(off, visibleEls, [], { panX, panY, zoom });

  return off.toDataURL("image/png", 0.7);
}

/**
 * useSlides — manages a list of slides, each storing a snapshot of canvas elements.
 * 
 * IMPORTANT: We use a synchronous ref (`stateRef`) alongside React state to avoid
 * React 18's batched/async setState timing issues. All read operations use the ref
 * for immediate synchronous access, and setState is called to trigger re-renders.
 */
export function useSlides() {
  const [state, _setState] = useState<SlidesState>({
    slides: [],
    currentIndex: -1,
    enabled: false,
  });

  // ★ Synchronous mirror of state — always up-to-date, not subject to React batching
  const stateRef = useRef(state);

  // Wrapper that keeps both in sync
  const setState = useCallback((newState: SlidesState) => {
    stateRef.current = newState;
    _setState(newState);
  }, []);

  const idCounter = useRef(0);

  /** Internal: save elements into a slide at index, returns new slides array */
  function withSavedSlide(slides: SlideItem[], index: number, elements: WhiteboardElement[]): SlideItem[] {
    const next = [...slides];
    if (index >= 0 && index < next.length) {
      const cloned = cloneElements(elements);
      next[index] = {
        ...next[index],
        elements: cloned,
        thumbnailUrl: captureThumbnail(cloned),
      };
    }
    return next;
  }

  /**
   * Save the current canvas as a NEW slide.
   */
  const saveAsSlide = useCallback((elements: WhiteboardElement[], name?: string) => {
    const cloned = cloneElements(elements);
    const thumbnail = captureThumbnail(cloned);
    idCounter.current += 1;

    const newSlide: SlideItem = {
      id: `slide-${idCounter.current}`,
      name: name || `幻灯片 ${idCounter.current}`,
      elements: cloned,
      thumbnailUrl: thumbnail,
    };

    const prev = stateRef.current;
    const insertIdx = prev.currentIndex >= 0 ? prev.currentIndex + 1 : prev.slides.length;
    setState({
      slides: [
        ...prev.slides.slice(0, insertIdx),
        newSlide,
        ...prev.slides.slice(insertIdx),
      ],
      currentIndex: insertIdx,
      enabled: true,
    });
  }, [setState]);

  /**
   * Update the CURRENT slide with the canvas content (explicit save).
   */
  const updateCurrentSlide = useCallback((elements: WhiteboardElement[]) => {
    const prev = stateRef.current;
    if (prev.currentIndex < 0 || prev.currentIndex >= prev.slides.length) return;
    setState({
      ...prev,
      slides: withSavedSlide(prev.slides, prev.currentIndex, elements),
    });
  }, [setState]);

  /**
   * Navigate to a slide by index.
   * - Auto-saves current canvas to the slide being LEFT
   * - Returns the TARGET slide's elements (deep-cloned) for loading onto canvas
   */
  const goToSlide = useCallback((index: number, currentElements: WhiteboardElement[]): WhiteboardElement[] | null => {
    const prev = stateRef.current;
    if (index < 0 || index >= prev.slides.length) return null;
    if (index === prev.currentIndex) return null;

    // 1. Read target FIRST (before any modification)
    const targetElements = cloneElements(prev.slides[index].elements);

    // 2. Auto-save current canvas to the slide we're leaving
    let slides = prev.slides;
    if (prev.currentIndex >= 0 && prev.currentIndex < slides.length) {
      slides = withSavedSlide(slides, prev.currentIndex, currentElements);
    }

    // 3. Update state synchronously
    setState({ ...prev, slides, currentIndex: index });

    return targetElements;
  }, [setState]);

  /**
   * Go to next slide. Auto-saves current slide.
   */
  const nextSlide = useCallback((currentElements: WhiteboardElement[]): WhiteboardElement[] | null => {
    const prev = stateRef.current;
    if (prev.slides.length === 0) return null;
    const nextIdx = prev.currentIndex < prev.slides.length - 1 ? prev.currentIndex + 1 : prev.currentIndex;
    if (nextIdx === prev.currentIndex) return null;

    const targetElements = cloneElements(prev.slides[nextIdx].elements);
    const slides = withSavedSlide(prev.slides, prev.currentIndex, currentElements);
    setState({ ...prev, slides, currentIndex: nextIdx });

    return targetElements;
  }, [setState]);

  /**
   * Go to previous slide. Auto-saves current slide.
   */
  const prevSlide = useCallback((currentElements: WhiteboardElement[]): WhiteboardElement[] | null => {
    const prev = stateRef.current;
    if (prev.slides.length === 0) return null;
    const prevIdx = prev.currentIndex > 0 ? prev.currentIndex - 1 : prev.currentIndex;
    if (prevIdx === prev.currentIndex) return null;

    const targetElements = cloneElements(prev.slides[prevIdx].elements);
    const slides = withSavedSlide(prev.slides, prev.currentIndex, currentElements);
    setState({ ...prev, slides, currentIndex: prevIdx });

    return targetElements;
  }, [setState]);

  /**
   * Remove a slide. Returns elements of the new current slide (if changed).
   */
  const removeSlide = useCallback((index: number): WhiteboardElement[] | null => {
    const prev = stateRef.current;
    const next = prev.slides.filter((_, i) => i !== index);
    if (next.length === 0) {
      setState({ slides: next, currentIndex: -1, enabled: false });
      return null;
    }
    let newIdx = prev.currentIndex;
    let targetElements: WhiteboardElement[] | null = null;

    if (prev.currentIndex >= next.length) {
      newIdx = next.length - 1;
    } else if (index === prev.currentIndex) {
      newIdx = Math.min(prev.currentIndex, next.length - 1);
    } else if (index < prev.currentIndex) {
      newIdx = prev.currentIndex - 1;
    }
    if (newIdx !== prev.currentIndex || index === prev.currentIndex) {
      targetElements = cloneElements(next[newIdx].elements);
    }
    setState({ ...prev, slides: next, currentIndex: newIdx });
    return targetElements;
  }, [setState]);

  /**
   * Add a blank slide after the current one.
   * Auto-saves current canvas, returns empty array for canvas clearing.
   */
  const addBlankSlide = useCallback((currentElements: WhiteboardElement[]) => {
    idCounter.current += 1;
    const blankSlide: SlideItem = {
      id: `slide-${idCounter.current}`,
      name: `幻灯片 ${idCounter.current}`,
      elements: [],
      thumbnailUrl: captureThumbnail([]),
    };

    const prev = stateRef.current;
    let slides = prev.slides;
    if (prev.currentIndex >= 0 && prev.currentIndex < slides.length) {
      slides = withSavedSlide(slides, prev.currentIndex, currentElements);
    }
    const insertIdx = prev.currentIndex >= 0 ? prev.currentIndex + 1 : slides.length;
    const nextSlides = [...slides.slice(0, insertIdx), blankSlide, ...slides.slice(insertIdx)];
    setState({ slides: nextSlides, currentIndex: insertIdx, enabled: true });

    return [] as WhiteboardElement[];
  }, [setState]);

  const clearSlides = useCallback(() => {
    setState({ slides: [], currentIndex: -1, enabled: false });
  }, [setState]);

  const setSlidesEnabled = useCallback((v: boolean) => {
    const prev = stateRef.current;
    setState({ ...prev, enabled: v });
  }, [setState]);

  const loadSlides = useCallback((slidesData: SlideItem[]) => {
    idCounter.current = slidesData.length;
    setState({
      slides: slidesData,
      currentIndex: slidesData.length > 0 ? 0 : -1,
      enabled: slidesData.length > 0,
    });
  }, [setState]);

  const renameSlide = useCallback((index: number, name: string) => {
    const prev = stateRef.current;
    if (index < 0 || index >= prev.slides.length) return;
    const next = [...prev.slides];
    next[index] = { ...next[index], name };
    setState({ ...prev, slides: next });
  }, [setState]);

  const reorderSlide = useCallback((fromIndex: number, toIndex: number) => {
    const prev = stateRef.current;
    if (fromIndex < 0 || fromIndex >= prev.slides.length) return;
    if (toIndex < 0 || toIndex >= prev.slides.length) return;
    if (fromIndex === toIndex) return;
    const next = [...prev.slides];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    let newIdx = prev.currentIndex;
    if (prev.currentIndex === fromIndex) {
      newIdx = toIndex;
    } else if (fromIndex < prev.currentIndex && toIndex >= prev.currentIndex) {
      newIdx = prev.currentIndex - 1;
    } else if (fromIndex > prev.currentIndex && toIndex <= prev.currentIndex) {
      newIdx = prev.currentIndex + 1;
    }
    setState({ ...prev, slides: next, currentIndex: newIdx });
  }, [setState]);

  /** Import image files as new slides */
  const addSlides = useCallback((files: FileList) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) return;
        idCounter.current += 1;
        const img = new Image();
        img.onload = () => {
          const tw = 320, th = 180;
          const tc = document.createElement("canvas");
          tc.width = tw; tc.height = th;
          const tctx = tc.getContext("2d");
          if (tctx) {
            tctx.fillStyle = "#fff";
            tctx.fillRect(0, 0, tw, th);
            const scale = Math.min(tw / img.width, th / img.height);
            const dw = img.width * scale, dh = img.height * scale;
            tctx.drawImage(img, (tw - dw) / 2, (th - dh) / 2, dw, dh);
          }
          const slide: SlideItem = {
            id: `slide-${idCounter.current}`,
            name: file.name.replace(/\.[^.]+$/, ""),
            elements: [{
              type: "image" as const,
              id: `img-${idCounter.current}`,
              x: 0, y: 0,
              width: img.width, height: img.height,
              dataUrl,
              isDeleted: false,
              rotation: 0,
            }] as unknown as WhiteboardElement[],
            thumbnailUrl: tc.toDataURL("image/png", 0.7),
          };
          const prev = stateRef.current;
          setState({ ...prev, slides: [...prev.slides, slide], enabled: true });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }, [setState]);

  return {
    slides: state.slides,
    currentIndex: state.currentIndex,
    slidesEnabled: state.enabled,
    setSlidesEnabled,
    saveAsSlide,
    updateCurrentSlide,
    addBlankSlide,
    addSlides,
    removeSlide,
    clearSlides,
    nextSlide,
    prevSlide,
    goToSlide,
    renameSlide,
    reorderSlide,
    loadSlides,
  };
}
