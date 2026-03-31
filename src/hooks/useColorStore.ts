import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY_RECENT_STROKE = "whiteboard_recent_stroke_colors";
const STORAGE_KEY_RECENT_FILL = "whiteboard_recent_fill_colors";
const STORAGE_KEY_FAVORITES = "whiteboard_favorite_colors";
const MAX_RECENT = 5;

function loadFromStorage(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(key: string, colors: string[]) {
  localStorage.setItem(key, JSON.stringify(colors));
}

export function useColorStore() {
  const [recentStrokeColors, setRecentStrokeColors] = useState<string[]>(() => loadFromStorage(STORAGE_KEY_RECENT_STROKE));
  const [recentFillColors, setRecentFillColors] = useState<string[]>(() => loadFromStorage(STORAGE_KEY_RECENT_FILL));
  const [favoriteColors, setFavoriteColors] = useState<string[]>(() => loadFromStorage(STORAGE_KEY_FAVORITES));

  useEffect(() => { saveToStorage(STORAGE_KEY_RECENT_STROKE, recentStrokeColors); }, [recentStrokeColors]);
  useEffect(() => { saveToStorage(STORAGE_KEY_RECENT_FILL, recentFillColors); }, [recentFillColors]);
  useEffect(() => { saveToStorage(STORAGE_KEY_FAVORITES, favoriteColors); }, [favoriteColors]);

  const addRecentStroke = useCallback((color: string) => {
    setRecentStrokeColors((prev) => {
      const next = [color, ...prev.filter((c) => c.toLowerCase() !== color.toLowerCase())];
      return next.slice(0, MAX_RECENT);
    });
  }, []);

  const addRecentFill = useCallback((color: string) => {
    setRecentFillColors((prev) => {
      const next = [color, ...prev.filter((c) => c.toLowerCase() !== color.toLowerCase())];
      return next.slice(0, MAX_RECENT);
    });
  }, []);

  const clearRecentStroke = useCallback(() => { setRecentStrokeColors([]); }, []);
  const clearRecentFill = useCallback(() => { setRecentFillColors([]); }, []);

  const toggleFavorite = useCallback((color: string) => {
    setFavoriteColors((prev) => {
      const lower = color.toLowerCase();
      if (prev.some((c) => c.toLowerCase() === lower)) {
        return prev.filter((c) => c.toLowerCase() !== lower);
      }
      return [...prev, color];
    });
  }, []);

  const isFavorite = useCallback((color: string) => {
    return favoriteColors.some((c) => c.toLowerCase() === color.toLowerCase());
  }, [favoriteColors]);

  return { recentStrokeColors, recentFillColors, favoriteColors, addRecentStroke, addRecentFill, clearRecentStroke, clearRecentFill, toggleFavorite, isFavorite };
}
