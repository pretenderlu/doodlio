# Doodlio 涂鸦板

[English](./README.md) | [简体中文](./README.zh-CN.md)

Doodlio 是一款手绘风格的在线白板应用，适合教学演示、内容创作、视觉化思考和产品讲解。它把手绘绘图、思维导图、Markdown 演示、录屏、摄像头采集、图层管理和 SVG 导出整合在一个轻量的浏览器工作区里。

## 功能亮点

- **手绘风格绘图** - 支持画笔、荧光笔、直线、矩形、椭圆、箭头和文本，基于 rough.js 渲染。
- **思维导图** - 支持水平、垂直、径向三种自动布局。
- **Smart Zoom 录屏** - 录制时自动聚焦鼠标操作区域，静止后平滑回到全景，灵感来自 Screen Studio。
- **多源采集** - 最多可同时采集并合成 4 路屏幕或摄像头来源。
- **Markdown 演示** - 浮动面板实时渲染 Markdown，并支持 XMind、FreeMind、OPML 脑图导入。
- **图层管理** - 创建图层，控制显示、隐藏和锁定。
- **SVG 导出** - 导出矢量图形，同时保留手绘视觉风格。
- **对齐辅助线** - 拖拽元素时自动吸附对齐。
- **触屏适配** - 支持双指缩放，并适配手写笔防误触。

## 快速开始

```bash
npm install
npm run dev
```

然后打开终端中显示的本地访问地址。

## 在线部署

Doodlio 是纯前端静态应用，可以部署到大多数现代托管平台。仓库内已包含常见平台的部署配置，Fork 后连接仓库即可快速上线。

### Vercel

1. 前往 [vercel.com](https://vercel.com)，使用 GitHub 登录。
2. 点击 **Add New -> Project**。
3. 导入本仓库，或导入你的 Fork 仓库。
4. 保持默认 Vite 构建设置。
5. 点击 **Deploy**。

每次推送到 `main` 分支后，Vercel 会自动重新部署。

### Netlify

1. 前往 [app.netlify.com](https://app.netlify.com)，使用 GitHub 登录。
2. 点击 **Add new site -> Import an existing project**。
3. 选择本仓库。
4. Netlify 会从 `netlify.toml` 读取构建设置。
5. 点击 **Deploy site**。

### Cloudflare Pages

1. 前往 [dash.cloudflare.com](https://dash.cloudflare.com)，进入 **Workers & Pages**。
2. 点击 **Create -> Pages -> Connect to Git**。
3. 选择本仓库。
4. 使用以下设置：
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. 点击 **Save and Deploy**。

### GitHub Pages

1. 在仓库设置中进入 **Pages**，将 **Source** 设为 **GitHub Actions**。
2. 如需每次 push 后自动部署，打开 `.github/workflows/deploy-pages.yml` 并启用 push 触发：

   ```yaml
   on:
     push:
       branches: [main]
     workflow_dispatch:
   ```

3. 如果部署在仓库路径下，修改 `vite.config.ts`：

   ```ts
   base: '/doodlio/'
   ```

4. 部署完成后访问 `https://<username>.github.io/doodlio/`。

### Docker

```bash
docker compose up -d
```

然后访问 `http://localhost:8080`。

### 平台对比

| 平台 | 费用 | 自动部署 | 自定义域名 | 特点 |
|---|---|---|---|---|
| Vercel | 免费额度 | 是 | 是 | Vite 零配置支持 |
| Netlify | 免费额度 | 是 | 是 | 分支预览和插件生态 |
| Cloudflare Pages | 免费额度 | 是 | 是 | 全球边缘网络和高带宽 |
| GitHub Pages | 免费 | 是 | 是 | GitHub 原生集成 |
| Docker | 自建 | 手动 | 是 | 适合私有或内网部署 |

## 快捷键

| 快捷键 | 功能 |
|---|---|
| `V` `P` `L` `R` `O` `A` `T` `E` `M` | 工具切换 |
| `Ctrl+C/V/D` | 复制 / 粘贴 / 快速复制 |
| `Ctrl+G` / `Ctrl+Shift+G` | 分组 / 取消分组 |
| `Ctrl+Z` / `Ctrl+Shift+Z` | 撤销 / 重做 |
| `Ctrl+Shift+S` | 导出 SVG |

完整快捷键列表见应用内菜单的 **帮助**。

## 技术栈

React 19 · TypeScript · Vite 7 · rough.js · perfect-freehand · marked

## 致谢

- **[Excalidraw](https://github.com/excalidraw/excalidraw)** - 手绘白板的代表性项目，也是 Doodlio 的核心灵感来源。MIT License。
- **[Excalicord](https://www.excalicord.com)** by [Zhang Rui](https://x.com/zarazhangrui) - 激发了这个项目的 vibe coding 欲望。
- **[Screen Studio](https://screen.studio/)** - Smart Zoom 功能的灵感来源。

## 许可证

[MIT](./LICENSE)
