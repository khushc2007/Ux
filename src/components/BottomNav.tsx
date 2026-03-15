import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";

interface Tab { id: string; label: string; sub: string; path: string; icon: (a: boolean) => JSX.Element }

/* ── SVG Icons ── */
const IcHome = (active: boolean) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M11 2L20 9.5V20H14V14H8V20H2V9.5L11 2Z"
      stroke={active ? "#00D4FF" : "#2a5068"} strokeWidth={active ? 1.6 : 1.2}
      fill={active ? "rgba(0,212,255,0.10)" : "none"} strokeLinejoin="round"
      style={{ transition: "all 0.25s" }} />
    {active && <circle cx="11" cy="11" r="2" fill="#00D4FF" opacity="0.7" />}
  </svg>
);
const IcDash = (active: boolean) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <circle cx="11" cy="11" r="3" fill={active ? "#00D4FF" : "#2a5068"} style={{ transition: "all 0.25s" }} />
    <circle cx="11" cy="11" r="6.5" stroke={active ? "#00D4FF" : "#2a5068"} strokeWidth="1" strokeDasharray={active ? "2 2" : "1 3"} opacity={active ? 0.7 : 0.4} />
    <circle cx="11" cy="11" r="9.5" stroke={active ? "#00D4FF" : "#2a5068"} strokeWidth="0.6" opacity={active ? 0.3 : 0.12} />
    {active && <circle cx="11" cy="11" r="3" fill="#00D4FF" opacity="0.4"><animate attributeName="r" values="3;8;3" dur="2s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" /></circle>}
  </svg>
);
const IcChamber = (active: boolean) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M11 2L20 7V15L11 20L2 15V7L11 2Z"
      stroke={active ? "#00D4FF" : "#2a5068"} strokeWidth={active ? 1.6 : 1.2}
      fill={active ? "rgba(0,212,255,0.08)" : "none"} style={{ transition: "all 0.25s" }} />
    <path d="M11 2V20M2 7L20 15M20 7L2 15"
      stroke={active ? "#00D4FF" : "#2a5068"} strokeWidth="0.7"
      opacity={active ? 0.45 : 0.2} />
    <circle cx="11" cy="11" r="2" fill={active ? "#00D4FF" : "#2a5068"} style={{ transition: "all 0.25s" }} />
  </svg>
);
const IcHistory = (active: boolean) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <polyline points="3,17 7,10 11,13 15,7 19,5"
      stroke={active ? "#00D4FF" : "#2a5068"} strokeWidth={active ? 1.6 : 1.2}
      strokeLinejoin="round" strokeLinecap="round" fill="none" style={{ transition: "all 0.25s" }} />
    {[3,7,11,15,19].map((x, i) => {
      const ys = [17,10,13,7,5];
      return <circle key={i} cx={x} cy={ys[i]} r="1.8"
        fill={active ? (i===4 ? "#00FFB2" : "#00D4FF") : "#2a5068"} style={{ transition: "all 0.25s" }} />;
    })}
    <line x1="3" y1="19.5" x2="19" y2="19.5" stroke={active ? "#00D4FF" : "#2a5068"} strokeWidth="0.6" opacity="0.35" />
  </svg>
);
const IcSettings = (active: boolean) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <circle cx="11" cy="11" r="3"
      stroke={active ? "#00D4FF" : "#2a5068"} strokeWidth={active ? 1.6 : 1.2}
      fill={active ? "rgba(0,212,255,0.12)" : "none"} style={{ transition: "all 0.25s" }} />
    {Array.from({ length: 8 }).map((_, i) => {
      const a = (i/8) * Math.PI * 2;
      return <line key={i} x1={11+Math.cos(a)*5.5} y1={11+Math.sin(a)*5.5}
        x2={11+Math.cos(a)*7.5} y2={11+Math.sin(a)*7.5}
        stroke={active ? "#00D4FF" : "#2a5068"} strokeWidth={active ? 1.6 : 1}
        strokeLinecap="round" style={{ transition: "all 0.25s" }} />;
    })}
  </svg>
);

const TABS: Tab[] = [
  { id: "home",      label: "Home",      sub: "OVERVIEW", path: "/home",      icon: IcHome     },
  { id: "dashboard", label: "Dashboard", sub: "LIVE",     path: "/dashboard", icon: IcDash     },
  { id: "chamber",   label: "Chamber",   sub: "3D SIM",   path: "/chamber",   icon: IcChamber  },
  { id: "history",   label: "History",   sub: "LOG",      path: "/history",   icon: IcHistory  },
  { id: "settings",  label: "Settings",  sub: "CONFIG",   path: "/settings",  icon: IcSettings },
];

function isActive(tabPath: string, loc: string) {
  if (tabPath === "/home") return loc === "/" || loc === "/home";
  return loc === tabPath || loc.startsWith(tabPath + "/");
}

export default function BottomNav() {
  const loc      = useLocation();
  const navigate = useNavigate();
  const [hov, setHov]     = useState<string | null>(null);
  const [press, setPress] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const activeIdx = TABS.findIndex(t => isActive(t.path, loc.pathname));

  // Keyboard arrow nav
  useEffect(() => {
    const el = navRef.current; if (!el) return;
    const kd = (e: KeyboardEvent) => {
      const btns = Array.from(el.querySelectorAll("button")) as HTMLButtonElement[];
      const idx  = btns.indexOf(document.activeElement as HTMLButtonElement);
      if (idx === -1) return;
      if (e.key === "ArrowRight") { e.preventDefault(); btns[(idx+1)%btns.length].focus(); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); btns[(idx-1+btns.length)%btns.length].focus(); }
    };
    el.addEventListener("keydown", kd);
    return () => el.removeEventListener("keydown", kd);
  }, []);

  return (
    <>
      <style>{NAV_CSS}</style>
      <nav ref={navRef} className="bnav" role="navigation" aria-label="Primary navigation">
        {/* Sliding pill */}
        {activeIdx >= 0 && (
          <div className="bnav__pill" style={{ left: `calc(${activeIdx} * 20%)`, width: "20%" }} />
        )}
        {/* Scan line */}
        <div className="bnav__scan" aria-hidden="true" />

        {TABS.map(tab => {
          const active = isActive(tab.path, loc.pathname);
          const hover  = hov === tab.id && !active;
          return (
            <button key={tab.id}
              className={["bnav__tab", active?"bnav__tab--active":"", hover?"bnav__tab--hover":"", press===tab.id?"bnav__tab--press":""].join(" ")}
              onClick={() => navigate(tab.path)}
              onMouseEnter={() => setHov(tab.id)}
              onMouseLeave={() => { setHov(null); setPress(null); }}
              onMouseDown={() => setPress(tab.id)}
              onMouseUp={() => setPress(null)}
              onTouchStart={() => setPress(tab.id)}
              onTouchEnd={() => setPress(null)}
              aria-current={active ? "page" : undefined}
              aria-label={tab.label}
            >
              <span className={`bnav__bar ${active?"bnav__bar--on":""}`} />
              {active && <span className="bnav__glow" />}
              <span className="bnav__icon">{tab.icon(active)}</span>
              <span className="bnav__labels">
                <span className="bnav__label">{tab.label}</span>
                <span className="bnav__sub">{tab.sub}</span>
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

const NAV_CSS = `
  .bnav {
    position: fixed; bottom: 0; left: 0; width: 100%; height: var(--nav-h); z-index: 9999;
    display: flex; align-items: stretch;
    background: linear-gradient(180deg, rgba(2,10,20,0.90) 0%, rgba(1,7,15,0.98) 100%);
    border-top: 1px solid rgba(0,212,255,0.09);
    box-shadow: 0 -2px 0 rgba(0,212,255,0.05), 0 -12px 40px rgba(0,0,0,0.6);
    backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px);
    overflow: hidden;
  }
  /* Diagonal stripe texture on nav — matches body */
  .bnav::before {
    content: ''; position: absolute; inset: 0;
    background-image: repeating-linear-gradient(-52deg, transparent 0px, transparent 50px, rgba(0,70,150,0.12) 50px, rgba(0,70,150,0.12) 58px, transparent 58px, transparent 118px, rgba(0,55,120,0.07) 118px, rgba(0,55,120,0.07) 126px);
    pointer-events: none;
  }
  .bnav__scan {
    position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(0,212,255,0.4) 50%, transparent 100%);
    animation: scanSlide 4s ease-in-out infinite;
    pointer-events: none;
  }
  .bnav__pill {
    position: absolute; top: 0; bottom: 0;
    background: rgba(0,212,255,0.04);
    transition: left 0.32s cubic-bezier(0.34,1.4,0.64,1);
    pointer-events: none;
  }
  .bnav__tab {
    position: relative; flex: 1;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
    padding: 0 4px 6px; border: none; background: transparent; cursor: pointer;
    outline: none; -webkit-tap-highlight-color: transparent;
    transition: transform 0.18s ease; overflow: hidden;
  }
  .bnav__tab:focus-visible { box-shadow: inset 0 0 0 1.5px rgba(0,212,255,0.5); }
  .bnav__tab--hover { background: rgba(0,212,255,0.025); }
  .bnav__tab--press { transform: scale(0.93); }
  .bnav__tab::after {
    content: ''; position: absolute; top: 0; left: -100%; width: 60%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(0,212,255,0.04), transparent);
    pointer-events: none;
  }
  .bnav__tab--hover::after { animation: bnavScan 0.5s ease-out forwards; }
  @keyframes bnavScan { from { left: -60%; } to { left: 140%; } }
  .bnav__bar {
    position: absolute; top: 0; left: 20%; width: 60%; height: 2px;
    background: transparent; border-radius: 0 0 2px 2px;
    transition: background 0.25s, box-shadow 0.25s, width 0.32s cubic-bezier(0.34,1.4,0.64,1);
  }
  .bnav__bar--on {
    background: linear-gradient(90deg, #00D4FF, #00FFB2);
    box-shadow: 0 0 10px rgba(0,212,255,0.9), 0 0 24px rgba(0,212,255,0.4);
  }
  .bnav__glow {
    position: absolute; top: 4px; left: 50%; transform: translateX(-50%);
    width: 52px; height: 40px;
    background: radial-gradient(ellipse at 50% 30%, rgba(0,212,255,0.16) 0%, transparent 75%);
    pointer-events: none;
    animation: glowPulse 3.5s ease-in-out infinite;
  }
  .bnav__icon {
    position: relative; z-index: 1;
    display: flex; align-items: center; justify-content: center;
    width: 26px; height: 26px;
    transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
  }
  .bnav__tab--active .bnav__icon { transform: translateY(-2px); }
  .bnav__tab--hover  .bnav__icon { transform: translateY(-1px); }
  .bnav__labels { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; }
  .bnav__label {
    font-family: 'Rajdhani', sans-serif; font-size: 11px; font-weight: 600;
    letter-spacing: 0.04em; line-height: 1; color: #1a4060;
    transition: color 0.22s; white-space: nowrap;
  }
  .bnav__sub {
    font-family: 'JetBrains Mono', monospace; font-size: 7px; letter-spacing: 0.14em;
    color: #0d2235; line-height: 1; opacity: 0; transition: color 0.22s, opacity 0.22s;
  }
  .bnav__tab--active .bnav__label  { color: #C8E8F8; font-weight: 700; }
  .bnav__tab--active .bnav__sub    { color: #00D4FF; opacity: 0.65; }
  .bnav__tab--hover  .bnav__label  { color: #3a6a8a; }
  .bnav__tab--hover  .bnav__sub    { color: #1a4060; opacity: 0.7; }
  @media (min-width: 900px) {
    .bnav { left: 50%; transform: translateX(-50%); width: 620px;
      border-radius: 16px 16px 0 0; border-left: 1px solid rgba(0,212,255,0.09); border-right: 1px solid rgba(0,212,255,0.09); }
    .bnav::before { border-radius: 16px 16px 0 0; }
    .bnav__pill { border-radius: 10px 10px 0 0; }
  }
  @media (max-width: 360px) {
    .bnav { height: 62px; }
    .bnav__label { font-size: 9.5px; }
    .bnav__sub { display: none; }
  }
`;
