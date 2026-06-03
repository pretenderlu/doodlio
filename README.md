# Doodlio

[English](./README.md) | [简体中文](./README.zh-CN.md)

Doodlio is a hand-drawn online whiteboard for teaching, demos, visual thinking, and content creation. It brings together sketch-style drawing, mind maps, Markdown presentations, screen recording, camera capture, layers, and SVG export in a fast browser-based workspace.

## Highlights

- **Hand-drawn canvas** - Pen, highlighter, line, rectangle, ellipse, arrow, and text tools rendered with rough.js.
- **Mind maps** - Import and arrange ideas with horizontal, vertical, and radial layouts.
- **Smart Zoom recording** - Automatically zooms into mouse activity while recording, then smoothly returns to the full view, inspired by Screen Studio.
- **Multi-source capture** - Combine up to 4 screen or camera sources in one recording setup.
- **Markdown presentations** - Render notes in a floating panel and import XMind, FreeMind, and OPML mind maps.
- **Layer management** - Create layers and control visibility, locking, and organization.
- **SVG export** - Export vector artwork while preserving the sketch-like visual style.
- **Alignment guides** - Snap objects into place while dragging.
- **Touch-friendly input** - Supports pinch zoom and stylus-friendly palm rejection.

## Quick Start

```bash
npm install
npm run dev
```

Then open the local URL shown in your terminal.

## Deployment

Doodlio is a static frontend app and can be deployed to most modern hosting platforms. The repository includes ready-to-use deployment configuration, so you can fork it and connect it with minimal setup.

### Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New -> Project**.
3. Import this repository, or your fork.
4. Keep the default Vite settings.
5. Click **Deploy**.

Vercel will redeploy automatically whenever you push to `main`.

### Netlify

1. Go to [app.netlify.com](https://app.netlify.com) and sign in with GitHub.
2. Click **Add new site -> Import an existing project**.
3. Select this repository.
4. Netlify reads the build settings from `netlify.toml`.
5. Click **Deploy site**.

### Cloudflare Pages

1. Open [dash.cloudflare.com](https://dash.cloudflare.com), then go to **Workers & Pages**.
2. Click **Create -> Pages -> Connect to Git**.
3. Select this repository.
4. Use:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Click **Save and Deploy**.

### GitHub Pages

1. In the repository settings, go to **Pages** and set **Source** to **GitHub Actions**.
2. Open `.github/workflows/deploy-pages.yml` and enable deployment on push if desired:

   ```yaml
   on:
     push:
       branches: [main]
     workflow_dispatch:
   ```

3. If you deploy under a repository path, update `vite.config.ts`:

   ```ts
   base: '/doodlio/'
   ```

4. After deployment, visit `https://<username>.github.io/doodlio/`.

### Docker

```bash
docker compose up -d
```

Then visit `http://localhost:8080`.

### Platform Comparison

| Platform | Cost | Automatic deploys | Custom domain | Notes |
|---|---|---|---|---|
| Vercel | Free tier | Yes | Yes | Zero-config Vite support |
| Netlify | Free tier | Yes | Yes | Branch previews and plugin ecosystem |
| Cloudflare Pages | Free tier | Yes | Yes | Global edge network and generous bandwidth |
| GitHub Pages | Free | Yes | Yes | Native GitHub integration |
| Docker | Self-hosted | Manual | Yes | Full control for private or internal hosting |

## Shortcuts

| Shortcut | Action |
|---|---|
| `V` `P` `L` `R` `O` `A` `T` `E` `M` | Switch tools |
| `Ctrl+C/V/D` | Copy / paste / duplicate |
| `Ctrl+G` / `Ctrl+Shift+G` | Group / ungroup |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo |
| `Ctrl+Shift+S` | Export SVG |

You can find the full shortcut list in the in-app menu under **Help**.

## Tech Stack

React 19 · TypeScript · Vite 7 · rough.js · perfect-freehand · marked

## Credits

- **[Excalidraw](https://github.com/excalidraw/excalidraw)** - The landmark hand-drawn whiteboard project and a core inspiration. MIT License.
- **[Excalicord](https://www.excalicord.com)** by [Zhang Rui](https://x.com/zarazhangrui) - Sparked the desire to build this through vibe coding.
- **[Screen Studio](https://screen.studio/)** - The inspiration behind Smart Zoom.

## License

[MIT](./LICENSE)
