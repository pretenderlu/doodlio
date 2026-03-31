# Doodlio 涂鸦板

一款功能丰富的在线白板应用，支持手绘风格绘图、思维导图、多源采集录屏、Markdown / 脑图演示等功能，适用于教学演示、内容创作和头脑风暴。

## 功能特性

### 绘图工具
- **画笔** — 压感手写笔画，支持「默认」平滑笔画和「涂鸦」手绘风格两种线条风格
- **荧光笔** — 半透明高亮标注
- **直线 / 矩形 / 椭圆 / 箭头** — 手绘风格几何图形，基于 roughjs 渲染
- **文本** — 支持多行文本，可调字号和字体，可开关手绘风格边框
- **图片** — 支持文件选择和拖放插入，插入后自动选中
- **旋转** — 所有元素支持自由旋转（拖拽旋转手柄，Shift 吸附15°增量）

### 橡皮擦
- **笔画模式** — 点击删除整个元素
- **区域模式** — 框选批量删除
- **像素模式** — 精细擦除，可调画笔大小

### 激光笔
- 红色衰减轨迹，适合演示场景
- 可调轨迹持续时间
- 独立高层 Canvas 渲染，可穿透所有覆盖层

### 思维导图
- 点击创建根节点，Tab 添加子节点，Enter 添加兄弟节点
- 拖拽连线建立关系
- 双击编辑节点文本
- Space 折叠/展开子树
- 三种自动布局：水平（→）、垂直（↓）、径向（◎）
- 按层级自动着色

### 多源采集
- **屏幕/窗口/标签页采集** — 通过 `getDisplayMedia` 采集任意屏幕内容
- **设备采集** — 支持 HDMI 采集卡、USB 摄像头等外部设备（自动枚举所有视频设备）
- **最多 4 路同时采集** — 每路独立浮动窗口，可拖拽、可缩放
- **音频合并** — 采集源音频自动合并到录制流
- **工具栏快捷入口** — 📹 按钮弹出菜单，一键添加采集源

### Markdown / 脑图演示
- **打开 Markdown 文件** — `.md`、`.markdown`、`.txt` 格式，实时渲染富文本
- **脑图文件解析** — 支持 `.xmind`、`.mm`（FreeMind）、`.opml` 格式，自动转换为 Markdown 展示
- **浮动面板** — 可拖拽、可缩放、字号可调
- **录制优化** — 按需截图（事件驱动），不影响绘图性能

### 录屏
- 画布 + 摄像头画中画合成录制
- 支持麦克风音频采集
- **视频质量设置** — 分辨率（720p / 1080p / 2K / 4K）、帧率（24 / 30 / 60 fps）、码率（低 / 中 / 高 / 超高）
- 多种画面比例预设（16:9、4:3、9:16、1:1 等，适配 YouTube、抖音、小红书）
- 26+ 背景渐变/纯色预设
- 摄像头窗口可拖拽、可调大小，支持圆形/方形/超椭圆外观，带多层阴影效果
- 可选光标高亮显示
- 自动下载录制文件（优先 MP4，回退 WebM）
- **实时笔触录制** — 绘制过程完整录入视频，非仅最终结果
- **帧率节流优化** — 合成帧率匹配视频帧率，录制时绘图保持流畅跟手
- **智能缩放（Smart Zoom）** — 鼠标点击时自动 zoom in 到操作区域，静止后平滑 zoom out 回全景；可调缩放倍率、过渡速度、跟随灵敏度
- **多源采集合成** — 所有采集源浮窗内容自动合成到录制视频

### 画布操作
- **平移** — Space + 拖拽 / 鼠标中键拖拽 / 手掌工具
- **缩放** — 鼠标滚轮（0.1x ~ 5x），跟随光标位置；触屏双指缩放
- **撤销/重做** — 支持 50 步历史记录
- **多选** — Shift 点击 / 框选
- **选中框** — 带四角缩放手柄 + 旋转手柄，跟随元素旋转
- **对齐辅助线** — 拖拽元素时自动显示边缘/中心对齐参考线，吸附到邻近元素
- **复制/粘贴** — Ctrl+C/V 复制粘贴元素，Ctrl+D 快速复制，支持系统剪贴板图片粘贴
- **分组** — Ctrl+G 分组 / Ctrl+Shift+G 取消分组
- **图层管理** — 用户创建图层，控制整层的显示/隐藏、锁定/解锁，拖拽排序
- **右键菜单** — 快捷收藏工具到浮动工具栏

### 文件操作
- **保存** — 导出为 JSON 文件（含元素、幻灯片、视口状态）
- **打开** — 导入 JSON 文件恢复画布
- **导出图片** — 导出为 PNG
- **导出 SVG** — 矢量导出，保留 rough.js 手绘风格（Ctrl+Shift+S）
- **画布背景** — 7 种预设颜色 + 自定义
- **自动保存** — localStorage 定期保存，刷新不丢失

### 属性面板
- 笔触颜色（6 种预设 + 彩虹调色盘 + 颜色收藏 + 近期颜色历史）
- 填充颜色和填充样式（线影 / 交叉影线 / 实心）
- 笔触宽度、线条/边框虚线样式
- 粗糙度（建筑师 / 艺术家 / 漫画家）
- 画笔线条风格切换（默认平滑 / 涂鸦手绘）
- 圆角半径、透明度
- 文本边框开关（支持边框颜色、样式、粗糙度独立控制）
- 各工具特有属性动态显示

### 颜色选择器
- **彩虹调色盘** — 始终显示多彩渐变图标
- **颜色历史** — 自动记录最近使用的 5 个颜色（描边和填充分开存储）
- **颜色收藏** — 右键色块收藏/取消，收藏色带 ★ 标记
- **localStorage 持久化** — 刷新页面后不丢失

### 提词器
- 可拖拽浮动面板
- 自动滚动，可调速度
- 字号和透明度调节
- 播放/暂停/停止控制

### 幻灯片
- 画板内容保存为幻灯片
- 导入图片为幻灯片
- 拖拽排序、双击重命名
- 上一张/下一张快速切换（PageUp/PageDown）

## 键盘快捷键

| 快捷键 | 功能 |
|---|---|
| `V` / `1` | 选择工具 |
| `P` / `2` | 画笔 |
| `H` | 荧光笔 |
| `G` | 激光笔 |
| `L` / `3` | 直线 |
| `R` / `4` | 矩形 |
| `O` / `5` | 椭圆 |
| `A` / `6` | 箭头 |
| `T` / `7` | 文本 |
| `E` / `8` | 橡皮擦 |
| `M` / `9` | 思维导图 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Shift+Z` / `Ctrl+Y` | 重做 |
| `Ctrl+A` | 全选 |
| `Delete` / `Backspace` | 删除选中元素 |
| `[` / `]` | 减小/增大笔触宽度 |
| `Ctrl+C` / `Ctrl+V` | 复制 / 粘贴 |
| `Ctrl+D` | 快速复制选中元素 |
| `Ctrl+G` | 分组 |
| `Ctrl+Shift+G` | 取消分组 |
| `Ctrl+S` | 保存 |
| `Ctrl+O` | 打开 |
| `Ctrl+Shift+E` | 导出图片 |
| `Ctrl+Shift+S` | 导出 SVG |
| `Tab` | 思维导图：添加子节点 |
| `Enter` | 思维导图：添加兄弟节点 |
| `Space` | 思维导图：折叠/展开 |

## 技术栈

- **React 19** + **TypeScript 5.9** — 前端框架
- **Vite 7** — 构建工具
- **roughjs** — 手绘风格图形渲染
- **perfect-freehand** — 压感笔画生成
- **marked** — Markdown 渲染
- **html2canvas** — DOM 截图（按需触发）
- **JSZip** — XMind 文件解析
- **nanoid** — 唯一 ID 生成

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建产物
npm run preview
```

也可以双击项目根目录下的 `启动白板.vbs` 快速启动（无 CMD 窗口，自动打开浏览器）。

## 部署

本项目为纯静态应用，构建后的 `dist/` 目录可直接部署到任意 Web 服务器。

### 群晖 NAS（Web Station）

1. 在 File Station 中创建 `/web/doodlio/` 目录
2. 将 `dist/` 内容上传至该目录
3. Web Station → 网页服务门户 → 新增 → 填写端口（如 8080）→ 文档根目录 `/web/doodlio`
4. 访问 `http://NAS-IP:8080`

> **注意**：录屏和摄像头功能需要 HTTPS 或 localhost 环境。可通过群晖自带的反向代理（控制面板 → 登录门户 → 高级 → 反向代理）配置 HTTPS 访问。

### Docker 部署（NAS / VPS）

```bash
# 构建镜像
docker build -t doodlio .

# 运行容器（端口自定义）
docker run -d -p 8080:80 --name doodlio doodlio
```

## 项目结构

```
src/
├── App.tsx                     # 根组件（工具栏、录制、覆盖层编排）
├── main.tsx                    # 入口文件
├── components/                 # UI 组件
│   ├── Canvas.tsx              # 双层 Canvas + 激光层 + 触屏手势
│   ├── Toolbar.tsx             # 主工具栏（含思维导图布局方向切换）
│   ├── FloatingToolbar.tsx     # 可拖拽浮动收藏工具栏
│   ├── LayerPanel.tsx          # 图层管理面板
│   ├── PropertiesPanel.tsx     # 属性编辑面板
│   ├── ColorPickerButton.tsx   # 彩虹调色盘按钮
│   ├── ContextMenu.tsx         # 右键菜单
│   ├── HamburgerMenu.tsx       # 菜单（文件/背景/帮助）
│   ├── Teleprompter.tsx        # 提词器面板
│   ├── SlidesPanel.tsx         # 幻灯片管理面板
│   ├── MarkdownOverlay.tsx     # Markdown/脑图浮动面板
│   ├── CaptureOverlay.tsx      # 采集源浮动窗口
│   ├── WebcamOverlay.tsx       # 摄像头画中画窗口
│   ├── RecordingControls.tsx   # 录制按钮
│   └── RecordingSetupModal.tsx # 录制设置弹窗
├── hooks/                      # 自定义 Hooks
│   ├── useCanvas.ts            # 核心绘图交互引擎
│   ├── useElements.tsx         # 全局状态管理（useReducer + Context）
│   ├── useRecording.ts         # 录屏合成（Smart Zoom + 帧率节流）
│   ├── useCaptureSource.ts     # 多源采集管理器
│   ├── useMindMap.tsx          # 思维导图交互
│   ├── useSlides.ts            # 幻灯片状态管理
│   ├── useColorStore.ts        # 颜色历史/收藏（localStorage）
│   ├── useKeyboard.ts          # 键盘快捷键
│   ├── useWebcam.ts            # 摄像头管理
│   ├── useMediaDevices.ts      # 媒体设备枚举
│   ├── useAutoSave.ts          # 自动保存（debounced localStorage）
│   ├── useImageInsert.tsx      # 图片插入
│   └── useTextEditor.tsx       # 文本编辑
├── types/                      # 类型定义
│   ├── elements.ts             # 11 种元素类型 + 图层 + 状态 + Actions
│   └── viewport.ts             # 视口类型
├── utils/                      # 工具函数
│   ├── renderer.ts             # 主渲染函数（含 OffscreenCanvas 缓存）
│   ├── renderCache.ts          # 渲染缓存（脏区检测 + OffscreenCanvas）
│   ├── roughHelpers.ts         # roughjs 图形创建
│   ├── freehand.ts             # perfect-freehand 封装
│   ├── hitTest.ts              # 元素命中检测（含图层锁定/隐藏）
│   ├── snapGuides.ts           # 对齐辅助线与吸附算法
│   ├── svgExport.ts            # SVG 矢量导出
│   ├── coordinates.ts          # 坐标变换（屏幕 ↔ 世界）
│   ├── geometry.ts             # 几何计算
│   ├── squirclePath.ts         # 超椭圆路径算法
│   ├── mindmapLayout.ts        # 思维导图自动布局（水平/垂直/径向）
│   ├── mindmapRenderer.ts      # 思维导图渲染
│   ├── mindmapHelpers.ts       # 思维导图辅助函数
│   ├── mindmapParser.ts        # XMind/FreeMind/OPML 解析器
│   └── format.ts               # 文件名格式化
├── constants/
│   └── tools.tsx               # 工具定义与 SVG 图标
└── styles/
    └── index.css               # 全局样式
```

## 架构设计

- **状态管理**：使用 `useReducer` + React Context 集中管理，支持 50 步撤销/重做
- **三层 Canvas**：静态层（已提交元素）+ 动态层（实时交互）+ 激光层（高 z-index，pointer-events:none）
- **世界坐标系**：所有元素使用世界坐标存储，通过视口变换实现平移缩放
- **元素系统**：11 种元素类型的 TypeScript 可区分联合类型，支持软删除、z-index 排序、旋转、图层归属
- **Hi-DPI 适配**：根据 `devicePixelRatio` 自动缩放，确保高分屏清晰显示
- **渲染缓存**：OffscreenCanvas 缓存已渲染画面，元素/视口未变时跳过全量重绘
- **录制合成**：离屏 Canvas 两阶段合成（全帧渲染 → 智能裁切），摄像头始终在最上层
- **触屏适配**：双指缩放(pinch-to-zoom)、手写笔 Palm Rejection、多指冲突保护
- **MD 截图优化**：事件驱动按需截图（scroll/resize/font 变化时），通过 `requestIdleCallback` 空闲执行，不影响绘图性能
- **颜色管理**：独立的颜色历史/收藏 hook，描边和填充分离存储，localStorage 持久化
- **幻灯片管理**：使用同步 ref 镜像避免 React 异步 setState 批处理问题
- **安全上下文**：媒体设备 API 在非 HTTPS 环境下优雅降级

## 致谢

本项目的设计和实现受到以下优秀项目的启发：

- **[Excalidraw](https://github.com/excalidraw/excalidraw)** — 开源的手绘风格白板工具，本项目的手绘渲染、元素系统等核心理念源自 Excalidraw（MIT License）
- **[Excalicord](https://www.excalicord.com)** by [Zhang Rui](https://x.com/zarazhangrui) — 白板录屏工具，看到这个项目后激发了我 vibe coding 的欲望，本项目的录屏合成、画中画摄像头等录制功能的灵感来源
- **[Screen Studio](https://screen.studio/)** — 令人惊艳的 Mac 录屏工具，本项目的 Smart Zoom（鼠标跟踪自动缩放）功能正是源于对 Screen Studio 的痴迷

## 许可证

[MIT License](./LICENSE)
