import type { WhiteboardElement, MindMapNodeElement, MindMapLayoutDirection } from "../types/elements";
import { estimateNodeSize } from "./mindmapHelpers";

const LEVEL_GAP = 200;   // gap between levels
const NODE_GAP = 16;     // gap between sibling nodes

/**
 * Layout all mind map nodes as a tree.
 * Returns a Map of nodeId → {x, y} positions.
 */
export function layoutMindMapTree(
  elements: WhiteboardElement[],
  direction: MindMapLayoutDirection = "right"
): Map<string, { x: number; y: number }> {
  const nodes = elements.filter(
    (el) => el.type === "mindmap-node" && !el.isDeleted
  ) as MindMapNodeElement[];

  if (nodes.length === 0) return new Map();

  const nodeMap = new Map<string, MindMapNodeElement>();
  for (const n of nodes) nodeMap.set(n.id, n);

  const childrenOf = new Map<string, MindMapNodeElement[]>();
  const roots: MindMapNodeElement[] = [];

  for (const n of nodes) {
    if (n.parentId && nodeMap.has(n.parentId) && !n.collapsed) {
      const parent = n.parentId;
      if (!childrenOf.has(parent)) childrenOf.set(parent, []);
      childrenOf.get(parent)!.push(n);
    } else if (!n.parentId) {
      roots.push(n);
    }
  }

  // Filter out children of collapsed nodes
  for (const n of nodes) {
    if (n.collapsed) {
      childrenOf.delete(n.id);
    }
  }

  const positions = new Map<string, { x: number; y: number }>();

  const heightCache = new Map<string, number>();
  function getSubtreeHeight(nodeId: string): number {
    const cached = heightCache.get(nodeId);
    if (cached !== undefined) return cached;
    const node = nodeMap.get(nodeId);
    if (!node) return 0;
    const size = estimateNodeSize(node);
    const children = childrenOf.get(nodeId) || [];
    if (children.length === 0) { heightCache.set(nodeId, size.height); return size.height; }
    let totalChildHeight = 0;
    for (const child of children) {
      totalChildHeight += getSubtreeHeight(child.id);
    }
    totalChildHeight += (children.length - 1) * NODE_GAP;
    const result = Math.max(size.height, totalChildHeight);
    heightCache.set(nodeId, result);
    return result;
  }

  function layoutNode(nodeId: string, x: number, centerY: number) {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    const size = estimateNodeSize(node);

    // Position this node vertically centered
    positions.set(nodeId, { x, y: centerY - size.height / 2 });

    const children = childrenOf.get(nodeId) || [];
    if (children.length === 0) return;

    const childX = x + size.width + LEVEL_GAP;
    const totalChildHeight =
      children.reduce((sum, c) => sum + getSubtreeHeight(c.id), 0) +
      (children.length - 1) * NODE_GAP;

    let currentY = centerY - totalChildHeight / 2;

    for (const child of children) {
      const childTreeHeight = getSubtreeHeight(child.id);
      const childCenterY = currentY + childTreeHeight / 2;
      layoutNode(child.id, childX, childCenterY);
      currentY += childTreeHeight + NODE_GAP;
    }
  }

  if (direction === "down") {
    // Top-to-bottom vertical layout
    const widthCache = new Map<string, number>();
    function getSubtreeWidth(nodeId: string): number {
      const cached = widthCache.get(nodeId);
      if (cached !== undefined) return cached;
      const node = nodeMap.get(nodeId);
      if (!node) return 0;
      const size = estimateNodeSize(node);
      const children = childrenOf.get(nodeId) || [];
      if (children.length === 0) { widthCache.set(nodeId, size.width); return size.width; }
      let totalChildWidth = 0;
      for (const child of children) {
        totalChildWidth += getSubtreeWidth(child.id);
      }
      totalChildWidth += (children.length - 1) * NODE_GAP;
      const result = Math.max(size.width, totalChildWidth);
      widthCache.set(nodeId, result);
      return result;
    }

    function layoutNodeDown(nodeId: string, centerX: number, y: number) {
      const node = nodeMap.get(nodeId);
      if (!node) return;
      const size = estimateNodeSize(node);
      positions.set(nodeId, { x: centerX - size.width / 2, y });

      const children = childrenOf.get(nodeId) || [];
      if (children.length === 0) return;

      const childY = y + size.height + LEVEL_GAP * 0.5;
      const totalChildWidth =
        children.reduce((sum, c) => sum + getSubtreeWidth(c.id), 0) +
        (children.length - 1) * NODE_GAP;

      let currentX = centerX - totalChildWidth / 2;
      for (const child of children) {
        const childTreeWidth = getSubtreeWidth(child.id);
        const childCenterX = currentX + childTreeWidth / 2;
        layoutNodeDown(child.id, childCenterX, childY);
        currentX += childTreeWidth + NODE_GAP;
      }
    }

    let startX = 100;
    for (const root of roots) {
      const treeWidth = getSubtreeWidth(root.id);
      layoutNodeDown(root.id, startX + treeWidth / 2, 60);
      startX += treeWidth + NODE_GAP * 3;
    }

    return positions;
  }

  if (direction === "radial") {
    function layoutRadial(rootId: string, rootX: number, rootY: number) {
      const root = nodeMap.get(rootId);
      if (!root) return;
      positions.set(rootId, { x: rootX, y: rootY });

      const children = childrenOf.get(rootId) || [];
      if (children.length === 0) return;

      const angleStep = (2 * Math.PI) / children.length;
      children.forEach((child, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const childX = rootX + Math.cos(angle) * LEVEL_GAP;
        const childY = rootY + Math.sin(angle) * LEVEL_GAP;
        positions.set(child.id, { x: childX, y: childY });
        layoutRadialSubtree(child.id, childX, childY, angle, angleStep * 0.8, 2);
      });
    }

    function layoutRadialSubtree(nodeId: string, x: number, y: number, parentAngle: number, sectorAngle: number, depth: number) {
      const children = childrenOf.get(nodeId) || [];
      if (children.length === 0) return;

      const startAngle = parentAngle - sectorAngle / 2;
      const step = sectorAngle / Math.max(children.length - 1, 1);
      const radius = LEVEL_GAP * (0.7 + 0.15 * depth);

      children.forEach((child, i) => {
        const angle = children.length === 1 ? parentAngle : startAngle + step * i;
        const childX = x + Math.cos(angle) * radius;
        const childY = y + Math.sin(angle) * radius;
        positions.set(child.id, { x: childX, y: childY });
        layoutRadialSubtree(child.id, childX, childY, angle, sectorAngle / Math.max(children.length, 1), depth + 1);
      });
    }

    let offsetX = 300;
    for (const root of roots) {
      layoutRadial(root.id, offsetX, 300);
      offsetX += 600;
    }

    return positions;
  }

  // Default: horizontal (right) layout
  // Layout each root tree
  let startY = 100;
  for (const root of roots) {
    const treeHeight = getSubtreeHeight(root.id);
    layoutNode(root.id, 60, startY + treeHeight / 2);
    startY += treeHeight + NODE_GAP * 3;
  }

  return positions;
}
