import { useState, useRef, useEffect } from "react";
import { useUser } from "../hooks/useUser";

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function TopBar() {
  const { user, loading, signOut } = useUser();
  const [open, setOpen] = useState(false);
  const [time, setTime]  = useState(new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const roleLabel = user.role === "admin" ? "System Admin" : "Customer";
  const firstName = user.name.split(" ")[0];

  const menuItems = [
    { icon: "◈", label: `Hi, ${firstName}!`, sub: user.email || "Signed in", header: true },
    null,
    { icon: "◉", label: "Profile",      sub: "Account details" },
    { icon: "◌", label: "Preferences",  sub: "Theme & display" },
    { icon: "◷", label: "Session Logs", sub: "Activity history" },
    { icon: "⌗", label: "API Keys",     sub: "Manage tokens" },
    null,
    { icon: "⏻", label: "Sign Out", sub: "End session", danger: true },
  ];

  return (
    <>
      <style>{TOPBAR_CSS}</style>
      <header className="topbar">

        {/* Logo */}
        <div className="topbar__logo">
          <div className="topbar__logo-mark">
            <span className="dot dot-live" style={{ width: 6, height: 6 }} />
          </div>
          <span className="topbar__wordmark">
            WATER<span style={{ color: "var(--cyan)" }}>·</span>IQ
          </span>
          <span className="badge badge-cyan topbar__ver">v2</span>
        </div>

        {/* Center clock */}
        <div className="topbar__center">
          <span className="topbar__time">
            {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <span className="topbar__date">
            {time.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })}
          </span>
        </div>

        {/* User dropdown */}
        <div className="topbar__right" ref={ref}>
          <button
            className="topbar__user-btn"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            disabled={loading}
          >
            {user.photo
              ? <img
                  src={user.photo}
                  className="topbar__avatar topbar__avatar--img"
                  alt={user.name}
                  referrerPolicy="no-referrer"
                />
              : <div className="topbar__avatar">
                  {loading ? "…" : initials(user.name)}
                </div>
            }
            <div className="topbar__user-info">
              <span className="topbar__user-name">
                {loading ? "Loading…" : `Hi, ${firstName}`}
              </span>
              <span className="topbar__user-role">{roleLabel}</span>
            </div>
            <span className="topbar__chevron" style={{ transform: open ? "rotate(180deg)" : "none" }}>▾</span>
          </button>

          <div className={`topbar__dropdown ${open ? "topbar__dropdown--open" : ""}`} role="menu">
            {menuItems.map((item, i) => {
              if (item === null) return <div key={i} className="topbar__dd-divider" />;

              if (item.header) return (
                <div key={i} className="topbar__dd-header">
                  {user.photo
                    ? <img
                        src={user.photo}
                        referrerPolicy="no-referrer"
                        className="topbar__avatar topbar__avatar--lg topbar__avatar--img"
                        alt={user.name}
                      />
                    : <div className="topbar__avatar topbar__avatar--lg">{initials(user.name)}</div>
                  }
                  <div>
                    <div className="topbar__user-name" style={{ fontSize: 13 }}>{user.name}</div>
                    <div className="topbar__user-role">{roleLabel} · {item.sub}</div>
                  </div>
                </div>
              );

              return (
                <button
                  key={item.label}
                  role="menuitem"
                  className={`topbar__dd-item ${item.danger ? "topbar__dd-item--danger" : ""}`}
                  onClick={() => {
                    setOpen(false);
                    if (item.danger) signOut();
                  }}
                >
                  <span className="topbar__dd-item-icon">{item.icon}</span>
                  <div className="topbar__dd-item-text">
                    <span className="topbar__dd-item-label">{item.label}</span>
                    <span className="topbar__dd-item-sub">{item.sub}</span>
                  </div>
                </button>
              );
            })}
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
    padding: 0 16px; height: 52px;
    background: rgba(1,7,16,0.90);
    border-bottom: 1px solid rgba(0,212,255,0.10);
    backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
    box-shadow: 0 1px 0 rgba(0,212,255,0.05), 0 4px 20px rgba(0,0,0,0.5);
  }
  .topbar::after {
    content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(0,212,255,0.22) 50%, transparent 100%);
    pointer-events: none;
  }

  .topbar__logo { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .topbar__logo-mark {
    display: flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; border-radius: 7px;
    border: 1px solid rgba(0,212,255,0.20); background: rgba(0,212,255,0.07);
    flex-shrink: 0;
  }
  .topbar__wordmark {
    font-family: var(--f-display); font-size: 13px; font-weight: 800;
    letter-spacing: 0.12em; color: var(--text-primary); white-space: nowrap;
  }
  .topbar__ver { font-size: 8px !important; }

  .topbar__center {
    display: flex; flex-direction: column; align-items: center; gap: 0; flex-shrink: 0;
  }
  .topbar__time {
    font-family: var(--f-mono); font-size: 12px; font-weight: 600;
    color: var(--cyan); letter-spacing: 0.06em; line-height: 1.2;
  }
  .topbar__date {
    font-family: var(--f-mono); font-size: 9px; color: var(--text-dim); letter-spacing: 0.08em;
  }
  @media (max-width: 480px) { .topbar__center { display: none; } }

  .topbar__right { position: relative; flex-shrink: 0; }
  .topbar__user-btn {
    display: flex; align-items: center; gap: 7px;
    padding: 4px 9px 4px 5px; border-radius: 10px;
    border: 1px solid var(--border); background: rgba(4,14,30,0.60);
    cursor: pointer; transition: all 0.22s ease;
    backdrop-filter: blur(12px); outline: none;
  }
  .topbar__user-btn:hover:not(:disabled) { border-color: var(--border-mid); background: rgba(6,18,38,0.75); }
  .topbar__user-btn:disabled { opacity: 0.6; cursor: default; }

  .topbar__avatar {
    width: 26px; height: 26px; border-radius: 7px; flex-shrink: 0;
    background: linear-gradient(135deg, rgba(0,212,255,0.28), rgba(0,212,255,0.08));
    border: 1px solid rgba(0,212,255,0.25);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--f-mono); font-size: 9px; font-weight: 700; color: var(--cyan);
    overflow: hidden;
  }
  .topbar__avatar--img { object-fit: cover; padding: 0; }
  .topbar__avatar--lg { width: 34px; height: 34px; border-radius: 9px; font-size: 11px; }

  .topbar__user-info { display: flex; flex-direction: column; gap: 0; }
  .topbar__user-name {
    font-family: var(--f-heading); font-size: 12px; font-weight: 700;
    color: var(--text-primary); line-height: 1.2; white-space: nowrap;
  }
  .topbar__user-role {
    font-family: var(--f-mono); font-size: 8px; color: var(--text-secondary); letter-spacing: 0.06em;
  }
  .topbar__chevron {
    font-size: 9px; color: var(--text-secondary); transition: transform 0.22s ease; flex-shrink: 0;
  }
  @media (max-width: 480px) {
    .topbar__user-info { display: none; }
    .topbar__user-btn { padding: 4px 6px; gap: 0; }
  }

  .topbar__dropdown {
    position: absolute; top: calc(100% + 8px); right: 0;
    width: min(260px, 90vw);
    background: rgba(2,10,22,0.97); border: 1px solid var(--border-mid);
    border-radius: var(--r-xl); overflow: hidden;
    box-shadow: 0 16px 56px rgba(0,0,0,0.75), 0 0 0 1px rgba(0,212,255,0.06);
    backdrop-filter: blur(28px);
    opacity: 0; transform: translateY(-8px) scale(0.97);
    pointer-events: none;
    transition: opacity 0.2s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
    z-index: 9999;
  }
  .topbar__dropdown--open { opacity: 1; transform: translateY(0) scale(1); pointer-events: all; }
  .topbar__dd-header {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 14px 10px; background: rgba(0,212,255,0.03);
  }
  .topbar__dd-divider { height: 1px; background: var(--border); margin: 3px 0; }
  .topbar__dd-item {
    display: flex; align-items: center; gap: 10px;
    width: 100%; padding: 9px 14px; border: none; background: transparent;
    cursor: pointer; transition: background 0.16s ease; text-align: left; outline: none;
  }
  .topbar__dd-item:hover { background: rgba(0,212,255,0.05); }
  .topbar__dd-item--danger:hover { background: rgba(255,69,96,0.07); }
  .topbar__dd-item-icon {
    font-size: 13px; color: var(--text-secondary);
    width: 18px; text-align: center; flex-shrink: 0;
  }
  .topbar__dd-item--danger .topbar__dd-item-icon { color: var(--red); }
  .topbar__dd-item-text { display: flex; flex-direction: column; gap: 1px; }
  .topbar__dd-item-label {
    font-family: var(--f-heading); font-size: 12px; font-weight: 600; color: var(--text-primary);
  }
  .topbar__dd-item--danger .topbar__dd-item-label { color: var(--red); }
  .topbar__dd-item-sub { font-family: var(--f-mono); font-size: 9px; color: var(--text-secondary); }
`;
