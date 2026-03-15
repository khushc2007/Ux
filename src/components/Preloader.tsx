import { useEffect, useState } from "react";

interface PreloaderProps {
  onComplete: () => void;
}

export default function Preloader({ onComplete }: PreloaderProps) {
  const [phase, setPhase] = useState<"loading" | "reveal" | "done">("loading");
  const [progress, setProgress] = useState(0);
  const [drops, setDrops] = useState<{ id: number; x: number; delay: number; size: number }[]>([]);

  // Generate random drops on mount
  useEffect(() => {
    setDrops(Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: 5 + (i * 8.5),
      delay: i * 0.18,
      size: 4 + Math.random() * 6,
    })));
  }, []);

  // Progress bar — runs over ~2.8 seconds
  useEffect(() => {
    let current = 0;
    const steps = [
      { target: 35,  speed: 28 },
      { target: 65,  speed: 18 },
      { target: 85,  speed: 30 },
      { target: 100, speed: 14 },
    ];
    let stepIdx = 0;

    const tick = () => {
      if (stepIdx >= steps.length) return;
      const { target, speed } = steps[stepIdx];
      if (current < target) {
        current = Math.min(current + 1, target);
        setProgress(current);
        setTimeout(tick, speed);
      } else {
        stepIdx++;
        if (stepIdx < steps.length) setTimeout(tick, 120);
        else {
          // 100% — pause then reveal
          setTimeout(() => setPhase("reveal"), 400);
          setTimeout(() => setPhase("done"), 1100);
          setTimeout(() => onComplete(), 1300);
        }
      }
    };
    const id = setTimeout(tick, 300);
    return () => clearTimeout(id);
  }, [onComplete]);

  if (phase === "done") return null;

  return (
    <>
      <style>{PRELOADER_CSS}</style>
      <div className={`preloader ${phase === "reveal" ? "preloader--reveal" : ""}`}>

        {/* Thunder stripe background — matches app */}
        <div className="preloader__bg" />

        {/* Falling water drops */}
        {drops.map(d => (
          <div key={d.id} className="preloader__drop"
            style={{ left: `${d.x}%`, animationDelay: `${d.delay}s`, width: d.size, height: d.size * 1.5 }} />
        ))}

        {/* Center content */}
        <div className="preloader__center">

          {/* Animated water ring */}
          <div className="preloader__ring-wrap">
            <svg className="preloader__ring-svg" viewBox="0 0 120 120">
              <defs>
                <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00D4FF" />
                  <stop offset="100%" stopColor="#00FFB2" />
                </linearGradient>
              </defs>
              {/* Track */}
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(0,212,255,0.10)" strokeWidth="3" />
              {/* Animated arc */}
              <circle cx="60" cy="60" r="50" fill="none"
                stroke="url(#ring-grad)" strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(progress / 100) * 314} 314`}
                strokeDashoffset="78.5"
                style={{ transition: "stroke-dasharray 0.1s ease", filter: "drop-shadow(0 0 8px #00D4FF)" }} />
              {/* Inner pulse rings */}
              <circle cx="60" cy="60" r="38" fill="none" stroke="rgba(0,212,255,0.07)" strokeWidth="1" className="preloader__pulse-ring" />
              <circle cx="60" cy="60" r="26" fill="none" stroke="rgba(0,212,255,0.05)" strokeWidth="1" className="preloader__pulse-ring preloader__pulse-ring--2" />
            </svg>

            {/* Center logo */}
            <div className="preloader__logo-wrap">
              <div className="preloader__droplet">
                <svg viewBox="0 0 32 40" fill="none">
                  <path d="M16 0 C16 0 0 16 0 26 C0 34.8 7.2 40 16 40 C24.8 40 32 34.8 32 26 C32 16 16 0 16 0Z"
                    fill="url(#drop-grad)" style={{ filter: "drop-shadow(0 0 12px rgba(0,212,255,0.7))" }} />
                  <defs>
                    <linearGradient id="drop-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#00D4FF" />
                      <stop offset="100%" stopColor="#00FFB2" />
                    </linearGradient>
                  </defs>
                  <ellipse cx="11" cy="22" rx="4" ry="6" fill="rgba(255,255,255,0.25)" />
                </svg>
              </div>
            </div>
          </div>

          {/* Brand name */}
          <div className="preloader__brand">
            WATER<span style={{ color: "#00D4FF" }}>·</span>IQ
          </div>
          <div className="preloader__tagline">
            Smart Greywater Intelligence
          </div>

          {/* Progress bar */}
          <div className="preloader__bar-wrap">
            <div className="preloader__bar-track">
              <div className="preloader__bar-fill" style={{ width: `${progress}%` }} />
              {/* Shimmer on bar */}
              <div className="preloader__bar-shimmer" style={{ left: `${Math.max(0, progress - 8)}%` }} />
            </div>
            <div className="preloader__bar-labels">
              <span className="preloader__bar-label">
                {progress < 35 ? "Initializing sensors…" : progress < 65 ? "Loading intelligence…" : progress < 85 ? "Connecting backend…" : progress < 100 ? "Ready…" : "Complete"}
              </span>
              <span className="preloader__bar-pct">{progress}%</span>
            </div>
          </div>

          {/* Version badge */}
          <div className="preloader__version">v2 · Edge Intelligence · Station 01</div>
        </div>

        {/* Reveal overlay — sweeps up */}
        <div className={`preloader__curtain ${phase === "reveal" ? "preloader__curtain--up" : ""}`} />
      </div>
    </>
  );
}

const PRELOADER_CSS = `
  .preloader {
    position: fixed;
    inset: 0;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    transition: opacity 0.4s ease;
  }
  .preloader--reveal {
    pointer-events: none;
  }

  /* Thunder stripe bg — matches app exactly */
  .preloader__bg {
    position: absolute;
    inset: 0;
    background-color: #010A16;
    background-image:
      repeating-linear-gradient(
        -55deg,
        #010A16   0px,   #010A16  48px,
        #03162E  48px,   #03162E  62px,
        #010A16  62px,   #010A16 102px,
        #04213E 102px,   #04213E 112px,
        #010A16 112px,   #010A16 144px,
        rgba(0,90,180,0.28) 144px, rgba(0,90,180,0.28) 158px,
        #010A16 158px,   #010A16 188px,
        #051E38 188px,   #051E38 198px
      ),
      repeating-linear-gradient(
        -55deg,
        transparent          0px,  transparent         36px,
        rgba(0,60,140,0.18) 36px,  rgba(0,60,140,0.18) 44px,
        transparent         44px,  transparent         96px,
        rgba(0,45,120,0.12) 96px,  rgba(0,45,120,0.12) 102px
      ),
      radial-gradient(ellipse 75% 55% at 10% 3%, rgba(0,45,120,0.70) 0%, transparent 60%),
      radial-gradient(ellipse 60% 50% at 88% 94%, rgba(0,30,95,0.60) 0%, transparent 58%);
  }

  /* Falling drops */
  .preloader__drop {
    position: absolute;
    top: -20px;
    border-radius: 50% 50% 50% 50% / 40% 40% 60% 60%;
    background: linear-gradient(180deg, rgba(0,212,255,0.6), rgba(0,255,178,0.3));
    animation: preloaderDrop 2.2s ease-in infinite;
    filter: blur(0.5px);
  }
  @keyframes preloaderDrop {
    0%   { top: -20px; opacity: 0; }
    10%  { opacity: 0.8; }
    80%  { opacity: 0.5; }
    100% { top: 110vh; opacity: 0; }
  }

  /* Center block */
  .preloader__center {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    padding: 0 20px;
    text-align: center;
    animation: preloaderFadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both;
  }
  @keyframes preloaderFadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Ring */
  .preloader__ring-wrap {
    position: relative;
    width: 140px;
    height: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .preloader__ring-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    animation: preloaderSpin 8s linear infinite;
  }
  @keyframes preloaderSpin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  .preloader__pulse-ring {
    transform-origin: center;
    animation: preloaderPulseRing 2.4s ease-in-out infinite;
  }
  .preloader__pulse-ring--2 {
    animation-delay: 0.8s;
  }
  @keyframes preloaderPulseRing {
    0%,100% { opacity: 0.3; transform: scale(1); }
    50%     { opacity: 0.7; transform: scale(1.04); }
  }

  /* Droplet */
  .preloader__logo-wrap {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(0,212,255,0.06);
    border: 1px solid rgba(0,212,255,0.20);
  }
  .preloader__droplet {
    width: 28px;
    height: 35px;
    animation: preloaderFloat 3s ease-in-out infinite;
  }
  @keyframes preloaderFloat {
    0%,100% { transform: translateY(0); }
    50%     { transform: translateY(-5px); }
  }

  /* Brand */
  .preloader__brand {
    font-family: 'Orbitron', monospace;
    font-size: clamp(28px, 6vw, 42px);
    font-weight: 900;
    color: #C8E8F8;
    letter-spacing: 0.12em;
    line-height: 1;
    text-shadow: 0 0 40px rgba(0,212,255,0.3);
  }
  .preloader__tagline {
    font-family: 'JetBrains Mono', monospace;
    font-size: clamp(10px, 2vw, 13px);
    color: #4A7A98;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin-top: -8px;
  }

  /* Progress bar */
  .preloader__bar-wrap {
    width: min(340px, 85vw);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .preloader__bar-track {
    height: 3px;
    border-radius: 2px;
    background: rgba(0,212,255,0.10);
    overflow: hidden;
    position: relative;
  }
  .preloader__bar-fill {
    height: 100%;
    border-radius: 2px;
    background: linear-gradient(90deg, #00D4FF, #00FFB2);
    transition: width 0.12s ease;
    box-shadow: 0 0 8px rgba(0,212,255,0.8);
    position: relative;
    z-index: 1;
  }
  .preloader__bar-shimmer {
    position: absolute;
    top: 0;
    width: 16px;
    height: 100%;
    background: rgba(255,255,255,0.5);
    filter: blur(2px);
    pointer-events: none;
    transition: left 0.12s ease;
  }
  .preloader__bar-labels {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .preloader__bar-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #4A7A98;
    letter-spacing: 0.06em;
  }
  .preloader__bar-pct {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #00D4FF;
    font-weight: 700;
    letter-spacing: 0.08em;
  }

  .preloader__version {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: rgba(74,122,152,0.5);
    letter-spacing: 0.10em;
    text-transform: uppercase;
  }

  /* Reveal curtain — sweeps upward */
  .preloader__curtain {
    position: absolute;
    inset: 0;
    background: #010A16;
    z-index: 10;
    transform: translateY(100%);
    transition: none;
  }
  .preloader__curtain--up {
    transform: translateY(-100%);
    transition: transform 0.85s cubic-bezier(0.76, 0, 0.24, 1);
  }
`;
