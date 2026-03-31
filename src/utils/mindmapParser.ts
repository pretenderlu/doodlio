/**
 * Mind map file parser — converts .xmind, .mm (FreeMind), .opml to Markdown.
 */
import JSZip from "jszip";

// ---- Internal tree structure ----
interface MindNode {
  title: string;
  note?: string;
  children: MindNode[];
}

// ================================
// XMind (.xmind) parser
// ================================
async function parseXMind(buffer: ArrayBuffer): Promise<MindNode> {
  const zip = await JSZip.loadAsync(buffer);

  // XMind 8+ uses content.json
  const contentJson = zip.file("content.json");
  if (contentJson) {
    const raw = await contentJson.async("string");
    const data = JSON.parse(raw);
    // content.json is an array of sheets
    const sheets = Array.isArray(data) ? data : [data];
    const sheet = sheets[0];
    if (sheet?.rootTopic) {
      return convertXMindTopic(sheet.rootTopic);
    }
  }

  // Fallback: older XMind format metadata.json
  const metaFile = zip.file("metadata.json");
  if (metaFile) {
    const raw = await metaFile.async("string");
    const meta = JSON.parse(raw);
    return { title: meta.title || "XMind", children: [] };
  }

  return { title: "无法解析的 XMind 文件", children: [] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertXMindTopic(topic: any): MindNode {
  const node: MindNode = {
    title: topic.title || "",
    note: topic.notes?.plain?.content,
    children: [],
  };

  // Children can be in "children.attached" or "children"
  const attached = topic.children?.attached ?? topic.children ?? [];
  const childArray = Array.isArray(attached) ? attached : [];
  for (const child of childArray) {
    node.children.push(convertXMindTopic(child));
  }

  return node;
}

// ================================
// FreeMind (.mm) parser
// ================================
function parseFreeMind(xmlText: string): MindNode {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const rootNode = doc.querySelector("map > node");
  if (!rootNode) {
    return { title: "无法解析的 FreeMind 文件", children: [] };
  }
  return convertMMNode(rootNode);
}

function convertMMNode(el: Element): MindNode {
  const title = el.getAttribute("TEXT") || el.getAttribute("text") || "";
  const noteEl = el.querySelector(":scope > richcontent[TYPE='NOTE']");
  const note = noteEl?.textContent?.trim();
  const children: MindNode[] = [];
  for (const child of el.querySelectorAll(":scope > node")) {
    children.push(convertMMNode(child));
  }
  return { title, note, children };
}

// ================================
// OPML (.opml) parser
// ================================
function parseOPML(xmlText: string): MindNode {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const titleEl = doc.querySelector("head > title");
  const rootTitle = titleEl?.textContent || "OPML";
  const body = doc.querySelector("body");
  const children: MindNode[] = [];
  if (body) {
    for (const outline of body.querySelectorAll(":scope > outline")) {
      children.push(convertOPMLOutline(outline));
    }
  }
  return { title: rootTitle, children };
}

function convertOPMLOutline(el: Element): MindNode {
  const title = el.getAttribute("text") || el.getAttribute("title") || "";
  const note = el.getAttribute("_note") || undefined;
  const children: MindNode[] = [];
  for (const child of el.querySelectorAll(":scope > outline")) {
    children.push(convertOPMLOutline(child));
  }
  return { title, note, children };
}

// ================================
// Tree → Markdown
// ================================
function treeToMarkdown(node: MindNode, depth: number = 0): string {
  let md = "";

  if (depth === 0) {
    // Root node as H1
    md += `# ${node.title}\n\n`;
    if (node.note) {
      md += `> ${node.note.replace(/\n/g, "\n> ")}\n\n`;
    }
  } else if (depth === 1) {
    // First-level children as H2
    md += `## ${node.title}\n\n`;
    if (node.note) {
      md += `> ${node.note.replace(/\n/g, "\n> ")}\n\n`;
    }
  } else if (depth === 2) {
    // Second-level as H3
    md += `### ${node.title}\n\n`;
    if (node.note) {
      md += `> ${node.note.replace(/\n/g, "\n> ")}\n\n`;
    }
  } else {
    // Deeper levels as indented bullet list
    const indent = "  ".repeat(depth - 3);
    md += `${indent}- **${node.title}**`;
    if (node.note) {
      md += ` — _${node.note.replace(/\n/g, " ")}_`;
    }
    md += "\n";
  }

  for (const child of node.children) {
    md += treeToMarkdown(child, depth + 1);
  }

  return md;
}

// ================================
// Public API
// ================================
export type MindMapFormat = "xmind" | "mm" | "opml";

export function detectMindMapFormat(fileName: string): MindMapFormat | null {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "xmind") return "xmind";
  if (ext === "mm") return "mm";
  if (ext === "opml") return "opml";
  return null;
}

/**
 * Parse a mind map file and convert it to Markdown.
 */
export async function parseMindMapToMarkdown(
  file: File
): Promise<string> {
  const format = detectMindMapFormat(file.name);
  let tree: MindNode;

  switch (format) {
    case "xmind": {
      const buffer = await file.arrayBuffer();
      tree = await parseXMind(buffer);
      break;
    }
    case "mm": {
      const text = await file.text();
      tree = parseFreeMind(text);
      break;
    }
    case "opml": {
      const text = await file.text();
      tree = parseOPML(text);
      break;
    }
    default:
      return "# 不支持的文件格式\n\n无法解析该文件。";
  }

  return treeToMarkdown(tree);
}
