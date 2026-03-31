# Doodlio 涂鸦板

一款手绘风格的在线白板应用，支持录屏、思维导图、Markdown 演示，适用于教学演示和内容创作。

## 功能亮点

- **手绘风格绘图** — 画笔 / 荧光笔 / 直线 / 矩形 / 椭圆 / 箭头 / 文本，基于 rough.js 渲染
- **思维导图** — 水平 / 垂直 / 径向三种自动布局
- **Smart Zoom 录屏** — 鼠标操作时自动聚焦放大，静止后平滑回全景，灵感来自 Screen Studio
- **多源采集** — 最多 4 路屏幕 / 摄像头同时采集合成
- **Markdown 演示** — 浮动面板实时渲染，支持 XMind / FreeMind / OPML 脑图导入
- **图层管理** — 创建图层，控制显示 / 隐藏 / 锁定
- **SVG 导出** — 矢量导出，保留手绘风格
- **对齐辅助线** — 拖拽时自动吸附对齐
- **触屏适配** — 双指缩放，手写笔防误触

## 快速开始

```bash
npm install
npm run dev
```

或双击 `启动白板.vbs` 一键启动。

## 快捷键

| 快捷键 | 功能 |
|---|---|
| `V` `P` `L` `R` `O` `A` `T` `E` `M` | 工具切换 |
| `Ctrl+C/V/D` | 复制 / 粘贴 / 快速复制 |
| `Ctrl+G` / `Ctrl+Shift+G` | 分组 / 取消分组 |
| `Ctrl+Z` / `Ctrl+Shift+Z` | 撤销 / 重做 |
| `Ctrl+Shift+S` | 导出 SVG |

完整快捷键列表见应用内菜单 → 帮助。

## 技术栈

React 19 · TypeScript · Vite 7 · rough.js · perfect-freehand · marked

## 致谢

- **[Excalidraw](https://github.com/excalidraw/excalidraw)** — 手绘白板的开山之作，核心理念来源（MIT License）
- **[Excalicord](https://www.excalicord.com)** by [Zhang Rui](https://x.com/zarazhangrui) — 激发了这个项目 vibe coding 的欲望
- **[Screen Studio](https://screen.studio/)** — Smart Zoom 功能源于对它的痴迷

## 许可证

[MIT](./LICENSE)
