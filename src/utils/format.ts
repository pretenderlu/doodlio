/** Generate a timestamped filename like "whiteboard_20260311_1430.json" */
export function timestampFilename(prefix: string, ext: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  return `${prefix}_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.${ext}`;
}
