import { useState, useCallback } from "react";

const STORAGE_KEY = "doodlio-welcome-seen";

export function useWelcomeGuide() {
  const [show, setShow] = useState(() => {
    try {
      return !localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  });

  const dismiss = useCallback(() => {
    setShow(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch { /* ignore */ }
  }, []);

  return { showWelcome: show, dismissWelcome: dismiss };
}

// ---- Step definitions ----
interface Step {
  title: string;
  desc: string;
  icon: () => React.ReactNode;
}

const svgProps: React.SVGAttributes<SVGElement> = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const STEPS: Step[] = [
  {
    title: "欢迎使用 Doodlio 涂鸦板",
    desc: "一款手绘风格的在线白板，支持录屏、思维导图、Markdown 演示，适用于教学演示和内容创作。完全免费且开源。",
    icon: () => (
      <svg width={48} height={48} viewBox="0 0 48 48" {...svgProps} strokeWidth={1.2}>
        <rect x="4" y="4" width="40" height="40" rx="8" />
        <path d="M14 20c0-4 3-8 10-8s10 4 10 8-3 5-6 5h-2c-1.5 0-2 1-2 2v2" />
        <circle cx="24" cy="35" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    title: "丰富的绘图工具",
    desc: "画笔、荧光笔、激光笔、直线、矩形、椭圆、箭头、文本 — 全部基于 rough.js 手绘风格渲染。支持图层管理、对齐辅助线和 SVG 矢量导出。",
    icon: () => (
      <svg width={48} height={48} viewBox="0 0 48 48" {...svgProps} strokeWidth={1.2}>
        <path d="M28 8l12 12L16 44H4V32L28 8z" />
        <line x1="28" y1="8" x2="40" y2="20" />
        <line x1="4" y1="32" x2="16" y2="44" />
        <path d="M22 14l12 12" />
      </svg>
    ),
  },
  {
    title: "Smart Zoom 智能录屏",
    desc: "内置屏幕录制，支持多路摄像头/屏幕采集合成。Smart Zoom 在鼠标操作时自动聚焦放大，静止后平滑回全景，让你的教学视频更专业。",
    icon: () => (
      <svg width={48} height={48} viewBox="0 0 48 48" {...svgProps} strokeWidth={1.2}>
        <rect x="4" y="8" width="40" height="28" rx="4" />
        <circle cx="24" cy="22" r="8" />
        <path d="M30 28l6 6" />
        <line x1="16" y1="42" x2="32" y2="42" />
        <line x1="24" y1="36" x2="24" y2="42" />
      </svg>
    ),
  },
  {
    title: "思维导图 & Markdown",
    desc: "一键创建思维导图，支持水平、垂直、径向三种自动布局。浮动 Markdown 面板实时渲染，还可导入 XMind / FreeMind / OPML 脑图文件。",
    icon: () => (
      <svg width={48} height={48} viewBox="0 0 48 48" {...svgProps} strokeWidth={1.2}>
        <rect x="16" y="16" width="16" height="16" rx="4" />
        <rect x="2" y="4" width="12" height="8" rx="3" />
        <rect x="34" y="4" width="12" height="8" rx="3" />
        <rect x="2" y="36" width="12" height="8" rx="3" />
        <rect x="34" y="36" width="12" height="8" rx="3" />
        <line x1="8" y1="12" x2="20" y2="20" />
        <line x1="40" y1="12" x2="28" y2="20" />
        <line x1="8" y1="36" x2="20" y2="28" />
        <line x1="40" y1="36" x2="28" y2="28" />
      </svg>
    ),
  },
  {
    title: "觉得不错？给个 Star 吧",
    desc: "Doodlio 是开源项目，你的 Star 是我们持续更新的最大动力。点击下方按钮前往 GitHub，顺手点个 Star 支持一下吧！",
    icon: () => (
      <svg width={48} height={48} viewBox="0 0 48 48" {...svgProps} strokeWidth={1.2}>
        <path d="M24 4l6.2 12.6L44 18.5l-10 9.7L36.4 42 24 35.4 11.6 42 14 28.2 4 18.5l13.8-1.9z" fill="currentColor" opacity={0.15} />
        <path d="M24 4l6.2 12.6L44 18.5l-10 9.7L36.4 42 24 35.4 11.6 42 14 28.2 4 18.5l13.8-1.9z" />
      </svg>
    ),
  },
];

const GITHUB_URL = "https://github.com/pretenderlu/doodlio";

interface Props {
  onClose: () => void;
}

export function WelcomeGuide({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="welcome-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="welcome-modal">
        {/* Icon area */}
        <div className="welcome-icon-area">
          <div className="welcome-icon">{current.icon()}</div>
        </div>

        {/* Content */}
        <div className="welcome-content">
          <h2 className="welcome-title">{current.title}</h2>
          <p className="welcome-desc">{current.desc}</p>
        </div>

        {/* Progress dots */}
        <div className="welcome-dots">
          {STEPS.map((_, i) => (
            <button
              key={i}
              className={`welcome-dot ${i === step ? "active" : ""}`}
              onClick={() => setStep(i)}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="welcome-actions">
          {isLast ? (
            <>
              <button className="welcome-btn-secondary" onClick={onClose}>
                开始使用
              </button>
              <a
                className="welcome-btn-star"
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
              >
                <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                Star on GitHub
              </a>
            </>
          ) : (
            <>
              <button className="welcome-btn-skip" onClick={onClose}>
                跳过
              </button>
              <button className="welcome-btn-next" onClick={() => setStep(step + 1)}>
                下一步
                <svg width={14} height={14} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 4l6 6-6 6" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
