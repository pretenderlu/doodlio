import type { WhiteboardElement, MindMapNodeElement } from "../types/elements";

const NODE_PADDING_X = 16;
const NODE_PADDING_Y = 10;
const NODE_MIN_WIDTH = 60;

/** Approximate node size without needing a canvas context */
export function estimateNodeSize(node: MindMapNodeElement): { width: number; height: number } {
  const text = node.textContent || " ";
  const lines = text.split("\n");
  const charWidth = node.fontSize * 0.6;
  const lineHeight = node.fontSize * 1.3;
  let maxLineWidth = 0;
  for (const line of lines) {
    maxLineWidth = Math.max(maxLineWidth, line.length * charWidth);
  }
  return {
    width: Math.max(NODE_MIN_WIDTH, maxLineWidth + NODE_PADDING_X * 2),
    height: lines.length * lineHeight + NODE_PADDING_Y * 2,
  };
}

/** Get depth of a node by walking up the parent chain */
export function getNodeDepth(nodeId: string, elements: WhiteboardElement[]): number {
  let depth = 0;
  let current = elements.find((e) => e.id === nodeId) as MindMapNodeElement | undefined;
  while (current?.parentId) {
    depth++;
    current = elements.find((e) => e.id === current!.parentId) as MindMapNodeElement | undefined;
  }
  return depth;
}

/** Get all descendant node IDs (recursive) */
export function getDescendantIds(nodeId: string, elements: WhiteboardElement[]): string[] {
  const ids: string[] = [];
  const children = elements.filter(
    (e) => e.type === "mindmap-node" && !e.isDeleted && (e as MindMapNodeElement).parentId === nodeId
  ) as MindMapNodeElement[];
  for (const child of children) {
    ids.push(child.id);
    ids.push(...getDescendantIds(child.id, elements));
  }
  return ids;
}

/** Get all IDs that should be deleted when a mindmap node is deleted (node + descendants + edges) */
export function getMindMapCascadeDeleteIds(nodeId: string, elements: WhiteboardElement[]): string[] {
  const idsToDelete = getDescendantIds(nodeId, elements);
  idsToDelete.push(nodeId);
  // Also delete edges connected to any deleted node
  for (const el of elements) {
    if (el.type === "mindmap-edge" && !el.isDeleted) {
      if (idsToDelete.includes(el.fromNodeId) || idsToDelete.includes(el.toNodeId)) {
        idsToDelete.push(el.id);
      }
    }
  }
  return idsToDelete;
}
