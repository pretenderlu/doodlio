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

## 在线部署

Doodlio 是纯前端应用，可以一键部署到各大平台。仓库已内置所有平台的配置文件，**Fork 后直接连接即可，无需手动配置。**

### Vercel

1. 前往 [vercel.com](https://vercel.com)，使用 GitHub 登录
2. 点击 **Add New → Project**
3. 导入本仓库（`pretenderlu/doodlio`，或你 Fork 的仓库）
4. Vercel 会自动识别 Vite 框架，保持默认设置即可
5. 点击 **Deploy**，等待构建完成
6. 部署完成后会获得一个 `*.vercel.app` 域名

> 每次 push 到 main 分支会自动触发重新部署。

### Netlify

1. 前往 [app.netlify.com](https://app.netlify.com)，使用 GitHub 登录
2. 点击 **Add new site → Import an existing project**
3. 选择 GitHub，导入本仓库
4. 构建设置会从 `netlify.toml` 自动读取，无需修改
5. 点击 **Deploy site**
6. 部署完成后会获得一个 `*.netlify.app` 域名

> 支持自定义域名、表单收集、分支预览等功能。

### Cloudflare Pages

1. 前往 [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**
2. 点击 **Create → Pages → Connect to Git**
3. 选择本仓库，设置：
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. 点击 **Save and Deploy**
5. 部署完成后会获得一个 `*.pages.dev` 域名

> Cloudflare Pages 提供免费无限带宽和全球边缘网络，访问速度极快。

### GitHub Pages

1. 在仓库 **Settings → Pages** 中：
   - **Source** 选择 **GitHub Actions**
2. 仓库已包含 `.github/workflows/deploy-pages.yml`，push 到 main 分支后会自动构建部署
3. 部署完成后访问 `https://<username>.github.io/doodlio/`

> 如果使用 GitHub Pages 部署到子路径，需要修改 `vite.config.ts` 中的 `base` 为 `'/doodlio/'`。

### Docker

```bash
docker compose up -d
```

访问 `http://localhost:8080` 即可使用。

### 平台对比

| 平台 | 费用 | 自动部署 | 自定义域名 | 特点 |
|---|---|---|---|---|
| Vercel | 免费 | ✅ | ✅ | 零配置，Vite 原生支持 |
| Netlify | 免费 | ✅ | ✅ | 分支预览，插件生态 |
| Cloudflare Pages | 免费 | ✅ | ✅ | 无限带宽，全球边缘网络 |
| GitHub Pages | 免费 | ✅ | ✅ | 无需第三方账号 |
| Docker | 自建 | — | — | 完全可控，内网部署 |

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
