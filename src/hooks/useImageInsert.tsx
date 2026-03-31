import { useCallback, useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import { useWhiteboard } from "./useElements";
import { cacheImage } from "../utils/renderer";
import type { ImageElement } from "../types/elements";

export function useImageInsert() {
  const { state, dispatch } = useWhiteboard();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Use a ref so the change listener always calls the latest insertImage
  const insertImageRef = useRef<(file: File) => void>(undefined);

  const insertImage = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onerror = () => {
        console.error("FileReader failed:", reader.error);
      };
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onerror = () => {
          console.error("Image failed to load from dataUrl");
        };
        img.onload = () => {
          // Scale down if too large
          let w = img.naturalWidth;
          let h = img.naturalHeight;
          const maxW = window.innerWidth * 0.5;
          const maxH = (window.innerHeight - 52) * 0.5;

          if (w > maxW || h > maxH) {
            const scale = Math.min(maxW / w, maxH / h);
            w *= scale;
            h *= scale;
          }

          // Center on canvas
          const canvasEl = document.querySelector(".canvas-frame canvas") as HTMLCanvasElement | null;
          let cx: number, cy: number;
          if (canvasEl) {
            const rect = canvasEl.getBoundingClientRect();
            cx = (rect.width - w) / 2;
            cy = (rect.height - h) / 2;
          } else {
            cx = (window.innerWidth - w) / 2;
            cy = (window.innerHeight - 52 - h) / 2;
          }

          const maxZ = state.elements.reduce(
            (max, el) => (el.isDeleted ? max : Math.max(max, el.zIndex)),
            0
          );

          const el: ImageElement = {
            id: nanoid(),
            type: "image",
            x: cx,
            y: cy,
            width: w,
            height: h,
            imageDataUrl: dataUrl,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            style: { ...state.activeStyle },
            roughSeed: 0,
            isDeleted: false,
            zIndex: maxZ + 1,
          };

          // Pre-cache the loaded Image so renderImage finds it immediately
          cacheImage(el.id, img);
          // Atomically add element + switch to select tool + select the element
          dispatch({ type: "ADD_ELEMENT", element: el, select: true });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [state.elements, state.activeStyle, dispatch]
  );

  // Keep ref in sync with latest insertImage
  insertImageRef.current = insertImage;

  // Create a persistent hidden file input in the DOM (once)
  useEffect(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.position = "fixed";
    input.style.top = "-9999px";
    input.style.opacity = "0";
    document.body.appendChild(input);

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file && insertImageRef.current) {
        insertImageRef.current(file);
      }
      // Reset so the same file can be selected again
      input.value = "";
    });

    fileInputRef.current = input;

    return () => {
      document.body.removeChild(input);
    };
  }, []);

  const handleFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        insertImage(file);
      }
    },
    [insertImage]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  return { handleFilePicker, handleDrop, handleDragOver };
}
