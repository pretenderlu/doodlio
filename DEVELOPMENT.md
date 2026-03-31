# Doodlio 开发手册

> 适用于需要修改、扩展或二次开发 Doodlio 白板应用的开发者。

---

## 目录

- [环境搭建](#环境搭建)
- [项目架构](#项目架构)
- [核心概念](#核心概念)
- [模块详解](#模块详解)
- [新增元素类型](#新增元素类型)
- [新增工具](#新增工具)
- [录制系统](#录制系统)
- [覆盖层系统](#覆盖层系统)
- [样式与主题](#样式与主题)
- [构建与部署](#构建与部署)
- [常见问题](#常见问题)

---

## 环境搭建

### 系统要求

| 工具 | 最低版本 |
|------|----------|
| Node.js | 18+ |
| npm | 9+ |
| 浏览器 | Chrome 110+ / Edge 110+ / Firefox 115+ |

### 安装步骤

```bash
# 克隆项目
git clone <repo-url>
cd whiteboard

# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:5173）
npm run dev

# TypeScript 类型检查（不输出文件）
npx tsc --noEmit

# ESLint 代码检查
npm run lint

# 构建生产版本
npm run build

# 预览构建产物
npm run preview
```

### 开发工具推荐

- **VSCode** + 以下扩展：
  - ESLint
  - TypeScript Importer
  - Prettier
- **React DevTools** 浏览器扩展
- 建议开启 `strict` 模式 TypeScript 检查

---

## 项目架构

### 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19 | 前端框架 |
| TypeScript | 5.9 | 类型安全 |
| Vite | 7 | 构建/HMR 开发服务器 |
| rough.js | 4.6 | 手绘风格图形渲染 |
| perfect-freehand | 1.2 | 压感笔画曲线生成 |
| marked | 17 | Markdown → HTML |
| html2canvas | 1.4 | DOM → Canvas 截图（按需调用） |
| JSZip | 3.10 | XMind (.xmind) ZIP 文件解析 |
| nanoid | 5 | 唯一 ID 生成 |

### 目录结构

```
src/
├── App.tsx                     # 顶层编排：工具栏、Canvas、覆盖层
├── main.tsx                    # ReactDOM.createRoot 入口
├── components/                 # 可视化 UI 组件（纯渲染 + 局部交互）
├── hooks/                      # 业务逻辑 Hooks（状态管理、设备、录制）
├── types/                      # TypeScript 类型定义
├── utils/                      # 纯函数工具（渲染、坐标、命中测试）
├── constants/                  # 工具定义、图标 SVG
└── styles/                     # 全局 CSS
```

### 数据流

```
用户交互 (PointerEvent)
    ↓
useCanvas.ts (处理输入, 创建/更新元素)
    ↓
useElements.tsx (dispatch action → reducer → 新 state)
    ↓
React re-render → renderScene() (静态 Canvas 重绘)
                → 动态 Canvas (选框/橡皮擦/激光)
```

---

## 核心概念

### 1. 元素系统 (`types/elements.ts`)

所有白板内容都是 `WhiteboardElement`，这是一个 TypeScript **可区分联合类型**：

```typescript
type WhiteboardElement =
  | PenElement         // 压感笔画
  | LineElement        // 直线
  | RectangleElement   // 矩形
  | EllipseElement     // 椭圆
  | ArrowElement       // 箭头
  | TextElement        // 文本
  | ImageElement       // 图片
  | MindMapNodeElement // 思维导图节点
  | MindMapEdgeElement // 思维导图边
  | PixelEraserElement // 像素擦除笔画
  | GroupElement       // 分组容器
```

**公共基础字段** (`ElementBase`)：
- `id` — nanoid 生成的唯一标识
- `x, y, width, height` — 位置和尺寸（世界坐标）
- `style: StyleOptions` — 颜色、粗细、粗糙度等
- `roughSeed` — rough.js 随机种子（确保重绘一致）
- `isDeleted` — 软删除标记（撤销时恢复）
- `zIndex` — 绘制顺序
- `rotation?` — 旋转角度（弧度）
- `locked?` — 锁定（不可选中/移动）
- `isHidden?` — 隐藏（不渲染/不可命中）
- `layerId?` — 所属图层 ID
- `groupId?` — 所属分组 ID
- `_roughDrawable?` — 瞬态缓存（不序列化）

### 2. 状态管理 (`hooks/useElements.tsx`)

使用 `useReducer` + React Context 实现全局状态管理，**不依赖任何第三方状态库**。

```typescript
interface WhiteboardState {
  elements: WhiteboardElement[];     // 所有元素
  activeTool: ToolType;              // 当前工具
  activeStyle: StyleOptions;         // 当前画笔样式
  selectedElementIds: string[];      // 选中元素
  viewport: Viewport;                // 视口 (panX, panY, zoom)
  undoStack / redoStack;             // 历史记录栈（最多 50 步）
  // ... 各工具配置
}
```

**关键 Actions**：
| Action | 说明 |
|--------|------|
| `ADD_ELEMENT` | 添加新元素，自动压入 undo 栈 |
| `UPDATE_ELEMENT` | 更新单个元素属性 |
| `UPDATE_ELEMENTS` | 批量更新（用于多选拖拽） |
| `DELETE_ELEMENT` | 软删除 |
| `UNDO` / `REDO` | 撤销/重做 |
| `GROUP_ELEMENTS` | 将选中元素分组 |
| `UNGROUP_ELEMENTS` | 取消分组 |
| `PASTE_ELEMENTS` | 粘贴元素（批量添加） |
| `TOGGLE_LOCK` / `TOGGLE_HIDDEN` | 切换元素锁定/隐藏 |
| `ADD_LAYER` / `DELETE_LAYER` | 添加/删除图层 |
| `UPDATE_LAYER` | 更新图层属性（名称/可见/锁定） |
| `SET_ACTIVE_LAYER` | 设置当前活动图层 |
| `REORDER_LAYER` | 调整图层顺序 |
| `SET_VIEWPORT` | 设置视口 |
| `ZOOM_TO` | 向光标位置缩放 |

### 3. 双层 Canvas + 激光层

```
+---------------------------+
| laserCanvas (z:5000)      |  ← 激光笔轨迹（pointer-events:none）
+---------------------------+
| dynamicCanvas (z:auto)    |  ← 实时交互：选框、绘制预览、橡皮擦
+---------------------------+
| staticCanvas (z:auto)     |  ← 已提交元素的最终渲染
+---------------------------+
```

- **staticCanvas**：在 `elements` 或 `viewport` 变化时重绘全部元素
- **dynamicCanvas**：每帧 clear → 绘制当前操作（不触发状态更新，直接操作 canvas）
- **laserCanvas**：通过 App.tsx 中的独立 `<canvas>` 元素实现，覆盖整个视口

### 4. 坐标系

- **屏幕坐标** — 鼠标/触摸事件的 `clientX/clientY`，相对于浏览器窗口
- **世界坐标** — 元素存储的坐标，不受平移缩放影响

```typescript
// 屏幕 → 世界
function screenToWorld(screenX, screenY, viewport) {
  return [
    (screenX - viewport.panX) / viewport.zoom,
    (screenY - viewport.panY) / viewport.zoom,
  ];
}
```

### 5. Hi-DPI 处理

Canvas 的 `width/height` 属性（像素）设置为 `CSS尺寸 × devicePixelRatio`，然后 `ctx.scale(dpr, dpr)` 确保高分屏清晰渲染。**只在尺寸实际变化时**重设 canvas 尺寸（避免 HTML5 规范的 clear 行为）。

---

## 模块详解

### useCanvas.ts — 核心绘图引擎

**职责**：处理所有 pointer 事件，管理绘图/拖拽/选择/缩放/橡皮擦/激光笔的完整生命周期。

**关键状态**（全部用 ref，不触发 re-render）：
- `currentElement` — 正在绘制中的元素
- `isDrawing / isErasing / isLasering` — 交互模式标记
- `dragState` — 选中元素的拖拽/缩放/旋转状态
- `marqueeState` — 框选状态
- `laserTrail` — 激光笔轨迹点 `[x, y, timestamp][]`
- `snapGuides` — 当前对齐辅助线（拖拽元素时计算）
- `activePointerId / activePointerType` — 手写笔 Palm Rejection

**Pointer 事件流**：

```
pointerDown → 判断当前工具 → 进入对应模式
pointerMove → 根据模式更新（绘制/拖拽/框选/擦除/激光）
pointerUp   → 提交元素到 state / 结束模式
```

**涂鸦笔画的特殊处理**：
- `lineStyle === "sketchy"` 时，绘制中使用平滑线条预览（`_isLiveDrawing` 标记）
- 提交时才用 rough.js 生成最终样式（避免实时重随机化导致的抖动）

### useRecording.ts — 录屏合成

**核心循环** (`compositeFrame`)：

```
requestAnimationFrame →
1. 帧率节流（skip if < frameInterval）
2. Smart Zoom 虚拟摄像机更新（easeInOutQuart + dead zone）
3. 背景层绘制
4. staticCanvas + dynamicCanvas drawImage
5. 光标高亮
6. 采集源覆盖层
7. MD 覆盖层（缓存位图）
8. 激光笔层（zoom 前绘制，跟随内容缩放）
9. Smart Zoom 裁切
10. 摄像头层（带阴影 + 玻璃效果）
```

**MD 覆盖层的按需截图**：
- 录制开始时一次性截图所有 `[data-md-overlay]` 元素
- 监听 `md-visual-change` 自定义事件（由 MarkdownOverlay 在 scroll/resize/font 变化时派发）
- 每个覆盖层独立防抖 800ms，通过 `requestIdleCallback` 空闲执行
- 每 5s 慢速同步检查新增/移除的面板

**Smart Zoom**：
- 虚拟摄像机 `VirtualCamera` 跟踪 `zoom/centerX/centerY`
- mousedown → zoom in 到点击位置（easeInOutQuart 过渡，柔和起止）
- 空闲 N 秒后 → zoom out 到全景（zoom-out 比 zoom-in 慢 30% 更舒适）
- zoom in 时鼠标移动通过可配置 lerp damping 平滑跟随
- 死区机制：鼠标微移（<1% 画布范围）不触发镜头跟随，减少视觉晃动
- 可调参数：缩放倍率、过渡速度、回退延迟、跟随灵敏度

### useCaptureSource.ts — 多源采集管理

**管理模型**：
- `CaptureSourceItem[]` 数组，每项包含 `id, type, stream, label`
- `videoRefs` Map — 存储每个源的 `<video>` DOM 元素引用
- 最多 4 个并发源
- `stream.getVideoTracks()[0].onended` 自动清理

### useMindMap.tsx — 思维导图

**节点类型**：`MindMapNodeElement` 有 `parentId` 字段指向父节点

**布局算法** (`mindmapLayout.ts`)：三种方向 — 水平（Reingold-Tilford 树形）、垂直（上→下）、径向（极坐标）

**交互**：
- 点击空白 → 创建根节点
- 选中节点 + Tab → 创建子节点
- 选中节点 + Enter → 创建兄弟节点
- Space → 折叠/展开子树
- 双击 → 进入文本编辑

---

## 新增元素类型

如果要添加一个新的白板元素（例如 `star`），需要修改以下文件：

### Step 1: 定义类型 (`types/elements.ts`)

```typescript
export interface StarElement extends ElementBase {
  type: "star";
  points: number;  // 角数
}

// 添加到联合类型
export type WhiteboardElement = ... | StarElement;
```

### Step 2: 渲染 (`utils/renderer.ts`)

在 `renderElement` 的 switch 中添加：
```typescript
case "star":
  renderStar(ctx, rc, el);
  break;
```

### Step 3: 命中检测 (`utils/hitTest.ts`)

在 `hitTestElement` 的 switch 中添加：
```typescript
case "star":
  return hitTestAABB(x, y, el.x, el.y, el.width, el.height);
```

### Step 4: 绘制交互 (`hooks/useCanvas.ts`)

在 `handlePointerDown` 和 `handlePointerMove` 的 switch 中添加 star 的创建和更新逻辑。

### Step 5: 工具注册 (`constants/tools.tsx`)

```typescript
{ key: "star", label: "星形", category: "shapes", icon: <StarSVG /> }
```

---

## 新增工具

工具分为两类：

### 1. 绘图工具（产生元素）

参考 `rectangle` 的实现：
1. 在 `ToolType` 中添加类型
2. 在 `useCanvas.ts` 的 pointer 事件中处理
3. 在 `tools.tsx` 注册图标

### 2. 操作工具（不产生元素）

参考 `laser` 的实现：
1. 在 `ToolType` 中添加类型
2. 在 `useCanvas.ts` 中添加专用逻辑分支
3. 在 `tools.tsx` 注册图标

---

## 覆盖层系统

应用有三种覆盖层类型：

### WebcamOverlay
- 显示摄像头画面
- `position: fixed`，可拖拽缩放
- 支持圆形/方形/超椭圆外形
- 录制时由 `useRecording` 读取 `<video>` 元素直接 `drawImage`

### CaptureOverlay
- 显示屏幕/设备采集画面
- 每个实例绑定一个 `MediaStream`
- 录制时遍历所有活跃 `<video>` 元素进行合成

### MarkdownOverlay
- 显示 Markdown 渲染内容
- `data-md-overlay` 属性标记用于录制捕获
- 视觉变化时派发 `md-visual-change` 自定义事件（防抖 500ms）
- 录制系统通过 `html2canvas` 按需截图

**添加新覆盖层**：
1. 创建组件，设置 `position: fixed`
2. 添加 `data-*` 属性用于录制识别
3. 在 `useRecording.ts` 的 `compositeFrame` 中添加绘制逻辑

---

## 样式与主题

### CSS 结构

所有样式在 `styles/index.css` 中，使用原生 CSS。

### 关键 class

| class | 说明 |
|-------|------|
| `.app` | 根布局（flex column） |
| `.toolbar-container` | 顶部工具栏区域 |
| `.canvas-outer` | 画布外层容器 |
| `.canvas-frame` | 画布主容器（设置 aspectRatio） |
| `.properties-panel` | 左侧属性面板 |
| `.zoom-indicator` | 右下角缩放指示器 |
| `.floating-toolbar` | 底部浮动工具栏 |

### 修改颜色方案

全局颜色定义在 `index.css` 的顶部：
- 工具按钮激活色：`.tool-btn.active` 的 `background`
- 主题色：`#6c63ff`（属性面板标题、高亮等）
- 录制红：`#e03131`

---

## 构建与部署

### 开发

```bash
npm run dev          # 启动 Vite HMR 开发服务器
npx tsc --noEmit     # TypeScript 类型检查
npm run lint         # ESLint 检查
```

### 生产构建

```bash
npm run build        # tsc 编译 + vite 打包
npm run preview      # 本地预览构建产物
```

产物位于 `dist/` 目录，全部为静态文件。

### 部署选项

| 平台 | 方法 |
|------|------|
| **群晖 NAS** | `/web/doodlio/` + Web Station |
| **Nginx** | 静态文件服务 + `try_files $uri /index.html` |
| **Vercel / Netlify** | 连接 GitHub 仓库，build: `npm run build`，output: `dist` |
| **GitHub Pages** | `gh-pages` 分支或 Actions |

> **录屏功能**需要 Secure Context（HTTPS 或 localhost），部署时务必配置 HTTPS。

### 更新 github-release 版本

```bash
# 在项目根目录执行，将最新代码同步到 github-release
# 复制所有源代码（不含 node_modules）
xcopy /E /Y /I src github-release\src
copy /Y package.json github-release\package.json
copy /Y tsconfig*.json github-release\
copy /Y vite.config.ts github-release\
copy /Y index.html github-release\
copy /Y eslint.config.js github-release\
# 更新 README
copy /Y README.md github-release\README.md  # 或使用 github-release 专用的 README

# 然后在 github-release 目录下
cd github-release
npm install
npm run build
```

---

## 常见问题

### Q: 录屏功能不可用？
**A**: 录屏需要 Secure Context。确保通过 `https://` 或 `localhost` 访问。群晖 NAS 可通过反向代理配置 HTTPS。

### Q: 摄像头无法打开？
**A**: 同上，`getUserMedia` API 需要 Secure Context。另外检查浏览器是否已授予摄像头权限。

### Q: 录制时有卡顿？
**A**: 检查是否同时打开了大量 Markdown 面板。录制系统使用按需截图（不再轮询），但短时间内频繁操作 MD 面板仍可能产生开销。降低录制分辨率/帧率也可改善。

### Q: 幻灯片切换没有反应？
**A**: 确保已在幻灯片面板中启用幻灯片功能（开关按钮），然后使用 PageUp/PageDown 切换。

### Q: 保存的 JSON 文件太大？
**A**: 如果包含大量图片元素，每张图片的 base64 dataURL 都会被序列化。建议图片尽量压缩后再插入。

### Q: XMind 脑图文件打不开？
**A**: 确保是 `.xmind` 新版格式（ZIP 包含 `content.json`）。旧版 XMind 3 格式（`.xmind` 内含 `content.xml`）暂不支持。

### Q: 手绘风格看起来不够"手绘"？
**A**: 在属性面板中调高「粗糙度」滑块。三个预设分别是建筑师（低）、艺术家（中）、漫画家（高）。

---

## 版本历史

### v1.2.0 (2026-03-31)
- ✨ 新增对齐辅助线 — 拖拽元素时自动显示边缘/中心对齐参考线 + 吸附
- ✨ 新增复制粘贴 — Ctrl+C/V/D，支持系统剪贴板图片粘贴
- ✨ 新增 SVG 矢量导出 — 保留 rough.js 手绘风格（Ctrl+Shift+S）
- ✨ 新增元素分组 — Ctrl+G 分组 / Ctrl+Shift+G 取消分组
- ✨ 新增图层管理面板 — 用户创建图层，控制整层显示/隐藏、锁定/解锁
- ✨ 思维导图三种布局 — 水平（→）、垂直（↓）、径向（◎）
- ✨ 触屏支持 — 双指缩放、手写笔 Palm Rejection
- ✨ 自定义工具提示 — 工具栏 hover 显示美观的黑底白字提示框
- ⚡ 渲染缓存 — OffscreenCanvas 缓存，元素未变化时跳过重绘
- ⚡ Smart Zoom 平滑度优化 — easeInOutQuart 缓动、死区机制、可调跟随灵敏度
- 🐛 修复 Smart Zoom 下激光笔位置偏移（移到 zoom 裁切前绘制）
- 🐛 修复工具栏溢出滚动条

### v1.1.0 (2026-03-31)
- ✨ 新增多源采集系统（最多 4 路屏幕/设备同时采集）
- ✨ 新增 Markdown / 脑图文件浮动面板
- ✨ 支持 XMind、FreeMind、OPML 脑图格式解析
- ⚡ 录制 MD 覆盖层改为事件驱动按需截图（消除 400ms 轮询卡顿）
- ✨ 激光笔独立 Canvas 层，可穿透所有覆盖层
- 🐛 修复涂鸦笔画实时绘制时的抖动问题

### v1.0.0
- 🎉 初始版本
- 完整的绘图工具套件
- 思维导图
- Smart Zoom 录屏
- 幻灯片系统
- 提词器
