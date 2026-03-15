import { useState, useRef, useEffect } from "react";

const USER = { name: "Khush Chadha", role: "System Admin", avatar: "KC" };

export default function TopBar() {
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const menuItems = [
    { icon: "◈", label: "Profile", sub: "View account details" },
    { icon: "◉", label: "Preferences", sub: "Theme & display" },
    { icon: "◷", label: "Session Logs", sub: "Activity history" },
    { icon: "◎", label: "API Keys", sub: "Manage access tokens" },
    null, // divider
    { icon: "⏻", label: "Sign Out", sub: "End session", danger: true },
  ];

  return (
    <>
      <style>{TOPBAR_CSS}</style>
      <header className="topbar">
        {/* Left — Logo */}
        <div className="topbar__logo">
          <div className="topbar__logo-mark">
            <span className="dot dot-live" style={{ width: 6, height: 6 }} />
          </div>
          <span className="topbar__wordmark">
            WATER<span style={{ color: "var(--cyan)" }}>·</span>IQ
          </span>
          <span className="badge badge-cyan" style={{ fontSize: 8 }}>v2</span>
        </div>

        {/* Center — clock + status */}
        <div className="topbar__center">
          <span className="topbar__time t-mono">
            {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <span className="topbar__date t-mono">{time.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })}</span>
        </div>

        {/* Right — user dropdown */}
        <div className="topbar__right" ref={ref}>
          <button className="topbar__user-btn" onClick={() => setOpen(o => !o)} aria-expanded={open}>
            <div className="topbar__avatar">{USER.avatar}</div>
            <div className="topbar__user-info">
              <span className="topbar__user-name">{USER.name}</span>
              <span className="topbar__user-role">{USER.role}</span>
            </div>
            <span className="topbar__chevron" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
          </button>

          {/* Dropdown */}
          <div className={`topbar__dropdown ${open ? "topbar__dropdown--open" : ""}`}>
            {/* Header */}
            <div className="topbar__dd-header">
              <div className="topbar__avatar topbar__avatar--lg">{USER.avatar}</div>
              <div>
                <div className="topbar__user-name">{USER.name}</div>
                <div className="topbar__user-role">Station 01 · Active</div>
              </div>
            </div>

            <div className="topbar__dd-divider" />

            {menuItems.map((item, i) =>
              item === null ? (
                <div key={i} className="topbar__dd-divider" />
              ) : (
                <button key={item.label}
                  className={`topbar__dd-item ${item.danger ? "topbar__dd-item--danger" : ""}`}
                  onClick={() => setOpen(false)}
                >
                  <span className="topbar__dd-item-icon">{item.icon}</span>
                  <div className="topbar__dd-item-text">
                    <span className="topbar__dd-item-label">{item.label}</span>
                    <span className="topbar__dd-item-sub">{item.sub}</span>
                  </div>
                </button>
              )
            )}
          </div>
        </div>
      </header>
    </>
  );
}

const TOPBAR_CSS = `
  .topbar {
    position: sticky; top: 0; z-index: 800;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 18px; height: 52px;
    background: rgba(1,7,16,0.88);
    border-bottom: 1px solid rgba(0,212,255,0.08);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 1px 0 rgba(0,212,255,0.04), 0 4px 24px rgba(0,0,0,0.4);
  }
  .topbar::after {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0,212,255,0.25), transparent);
    pointer-events: none;
  }
  .topbar__logo { display: flex; align-items: center; gap: 8px; }
  .topbar__logo-mark { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; border: 1px solid rgba(0,212,255,0.18); background: rgba(0,212,255,0.06); }
  .topbar__wordmark { font-family: var(--f-display); font-size: 14px; font-weight: 800; letter-spacing: 0.12em; color: var(--text-primary); }
  .topbar__center { display: flex; flex-direction: column; align-items: center; gap: 1px; }
  .topbar__time { font-size: 13px; font-weight: 600; color: var(--cyan); letter-spacing: 0.06em; }
  .topbar__date { font-size: 9px; color: var(--text-dim); letter-spacing: 0.08em; }
  @media (max-width: 480px) { .topbar__center { display: none; } }

  /* User button */
  .topbar__right { position: relative; }
  .topbar__user-btn {
    display: flex; align-items: center; gap: 8px;
    padding: 5px 10px 5px 6px; border-radius: 10px;
    border: 1px solid var(--border); background: var(--bg-glass);
    cursor: pointer; transition: all 0.22s ease;
    backdrop-filter: blur(12px);
  }
  .topbar__user-btn:hover { border-color: var(--border-mid); background: var(--bg-glass-hover); }
  .topbar__avatar {
    width: 28px; height: 28px; border-radius: 8px;
    background: linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,212,255,0.08));
    border: 1px solid rgba(0,212,255,0.22);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--f-mono); font-size: 10px; font-weight: 700; color: var(--cyan);
    flex-shrink: 0;
  }
  .topbar__avatar--lg { width: 36px; height: 36px; border-radius: 10px; font-size: 12px; }
  .topbar__user-info { display: flex; flex-direction: column; gap: 1px; }
  .topbar__user-name { font-family: var(--f-heading); font-size: 12px; font-weight: 700; color: var(--text-primary); line-height: 1; }
  .topbar__user-role { font-family: var(--f-mono); font-size: 8px; color: var(--text-secondary); letter-spacing: 0.06em; }
  .topbar__chevron { font-size: 10px; color: var(--text-secondary); transition: transform 0.22s ease; }
  @media (max-width: 480px) { .topbar__user-info { display: none; } }

  /* Dropdown */
  .topbar__dropdown {
    position: absolute; top: calc(100% + 8px); right: 0;
    width: 240px; min-width: 200px;
    background: rgba(3,12,24,0.97); border: 1px solid var(--border-mid);
    border-radius: var(--r-lg); box-shadow: 0 16px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,212,255,0.05);
    backdrop-filter: blur(28px); overflow: hidden;
    opacity: 0; transform: translateY(-8px) scale(0.97);
    pointer-events: none;
    transition: opacity 0.2s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
    z-index: 9999;
  }
  .topbar__dropdown--open { opacity: 1; transform: translateY(0) scale(1); pointer-events: all; }
  .topbar__dd-header { display: flex; align-items: center; gap: 10px; padding: 14px 14px 10px; }
  .topbar__dd-divider { height: 1px; background: var(--border); margin: 4px 0; }
  .topbar__dd-item {
    display: flex; align-items: center; gap: 10px;
    width: 100%; padding: 9px 14px; border: none; background: transparent;
    cursor: pointer; transition: background 0.18s ease;
    text-align: left;
  }
  .topbar__dd-item:hover { background: rgba(0,212,255,0.06); }
  .topbar__dd-item--danger:hover { background: rgba(255,69,96,0.08); }
  .topbar__dd-item-icon { font-size: 14px; color: var(--text-secondary); width: 18px; text-align: center; flex-shrink: 0; }
  .topbar__dd-item--danger .topbar__dd-item-icon { color: var(--red); }
  .topbar__dd-item-text { display: flex; flex-direction: column; gap: 1px; }
  .topbar__dd-item-label { font-family: var(--f-heading); font-size: 12px; font-weight: 600; color: var(--text-primary); }
  .topbar__dd-item--danger .topbar__dd-item-label { color: var(--red); }
  .topbar__dd-item-sub { font-family: var(--f-mono); font-size: 9px; color: var(--text-secondary); }
`;
