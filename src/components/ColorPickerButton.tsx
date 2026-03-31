import { useRef, useCallback } from "react";

interface ColorPickerButtonProps {
  currentColor: string;
  onChange: (color: string) => void;
  onCommit?: (color: string) => void;
}

/**
 * A rainbow-gradient circle button that triggers the native color picker.
 * The button always shows a rainbow gradient (not the current color).
 * onCommit is debounced so only the final picked color is recorded.
 */
export function ColorPickerButton({ currentColor, onChange, onCommit }: ColorPickerButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const debouncedCommit = useCallback((color: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (onCommit) onCommit(color);
    }, 600);
  }, [onCommit]);

  return (
    <div className="props-color-picker-wrap">
      <button
        className="props-color-picker-btn"
        onClick={() => inputRef.current?.click()}
        title="调色盘"
        type="button"
      />
      <input
        ref={inputRef}
        type="color"
        className="props-color-picker-hidden"
        value={currentColor}
        onChange={(e) => {
          const color = e.target.value;
          onChange(color);
          debouncedCommit(color);
        }}
      />
    </div>
  );
}
