import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase = "IDLE" | "COLLECTING" | "ANALYZED" | "TRANSFERRING_MAIN" | "POST_FILTRATION" | "COMPLETE";
type Env   = "Development" | "Staging" | "Production";
type Stage = "pre_lamella" | "post_lamella";
type Section = "system" | "intelligence" | "sensors" | "tank" | "alerts" | "account";

interface SysStatus {
  phase: Phase; collected: number; active: boolean; stage: Stage;
  latencyMs?: number; online?: boolean;
}
interface Prediction {
  bracket?: string; reusable?: boolean; suggestedTank?: string;
  wqi?: { score: number; interpretation: string };
  confidence?: {
    score: number; level: string; recommendation: string;
    phTurbidityAgreement: number; phTdsAgreement: number; turbidityTdsAgreement: number;
    disagreementFlags?: string[];
  };
  flatline?: { anyFlatlined: boolean; failsafeTriggered: boolean; ph: boolean; turbidity: boolean; tds: boolean };
  recalibration?: {
    triggered: boolean; reason: string | null;
    correctedTurbidity: number | null; originalTurbidity: number | null; disagreementScore: number;
  };
  cycleFingerprint?: {
    cycleId: string; durationMs: number; phSlope: number; turbiditySlope: number; tdsSlope: number;
    anomalyScore: number; anomalyFlags: string[];
  };
  stageAware?: { stage: string; note: string };
}
interface Fingerprint {
  cycleId: string; durationMs: number; phSlope: number; turbiditySlope: number; tdsSlope: number;
  anomalyScore: number; anomalyFlags: string[];
}
interface AlertEntry { ts: number; type: string; value: string; }
interface Thresholds {
  flatlineWindow: number; flatlineEpsilon: number;
  recalThreshold: number; correctionFactor: number;
}
interface AlertConfig {
  wqiBelow: number; confidenceBelow: number; anomalyAbove: number; flatline: boolean;
  inApp: boolean; browser: boolean; vibration: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_URL = "https://backend-update-1.onrender.com";
const THRESHOLDS_DEFAULT: Thresholds = {
  flatlineWindow: 4, flatlineEpsilon: 0.01, recalThreshold: 0.35, correctionFactor: 0.88,
};
const ALERTS_DEFAULT: AlertConfig = {
  wqiBelow: 50, confidenceBelow: 0.70, anomalyAbove: 0.75, flatline: true,
  inApp: true, browser: false, vibration: false,
};
const ADMIN_EMAILS = ["admin@wateriq.io", "khushchadha", "khush"];
const SECTIONS: { id: Section; icon: string; label: string }[] = [
  { id: "system",       icon: "◈", label: "System"       },
  { id: "intelligence", icon: "⬡", label: "Intelligence"  },
  { id: "sensors",      icon: "◉", label: "Sensors"       },
  { id: "tank",         icon: "⬢", label: "Tank & Cycle"  },
  { id: "alerts",       icon: "◬", label: "Alerts"        },
  { id: "account",      icon: "◎", label: "Account"       },
];
const PHASE_COLORS: Record<Phase, string> = {
  IDLE:             "var(--text-secondary)",
  COLLECTING:       "var(--cyan)",
  ANALYZED:         "var(--emerald)",
  TRANSFERRING_MAIN:"var(--amber)",
  POST_FILTRATION:  "#c084fc",
  COMPLETE:         "var(--emerald)",
};
const PHASE_BG: Record<Phase, string> = {
  IDLE:             "rgba(74,122,152,0.12)",
  COLLECTING:       "rgba(0,212,255,0.10)",
  ANALYZED:         "rgba(0,255,178,0.10)",
  TRANSFERRING_MAIN:"rgba(255,176,32,0.10)",
  POST_FILTRATION:  "rgba(192,132,252,0.10)",
  COMPLETE:         "rgba(0,255,178,0.10)",
};

function getRole(email: string, name: string) {
  const e = email.toLowerCase(), n = name.toLowerCase();
  return ADMIN_EMAILS.some(a => e.includes(a) || n.includes(a)) ? "ADMIN" : "CUSTOMER";
}
function useWIQUser() {
  try {
    const raw = localStorage.getItem("wiq_user");
    if (raw) return JSON.parse(raw) as { name: string; email?: string; photo?: string };
  } catch {}
  return { name: "Khush Chadha", email: "admin@wateriq.io", photo: null };
}
function wqiColor(s: number) {
  if (s >= 80) return "var(--emerald)";
  if (s >= 65) return "var(--cyan)";
  if (s >= 50) return "var(--amber)";
  return "var(--red)";
}
function agreementColor(v: number) {
  if (v >= 0.85) return "var(--emerald)";
  if (v >= 0.70) return "var(--amber)";
  if (v >= 0.50) return "#f97316";
  return "var(--red)";
}

// ─── Hold-to-Confirm Button ───────────────────────────────────────────────────
function HoldButton({ label, color = "red", onConfirm, disabled = false }: {
  label: string; color?: "red" | "cyan" | "amber"; onConfirm: () => void; disabled?: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const HOLD_MS = 2000;
  const c = color === "cyan" ? "var(--cyan)" : color === "amber" ? "var(--amber)" : "var(--red)";

  function startHold() {
    startRef.current = Date.now();
    function tick() {
      const p = Math.min(100, ((Date.now() - (startRef.current ?? Date.now())) / HOLD_MS) * 100);
      setProgress(p);
      if (p >= 100) { onConfirm(); setProgress(0); return; }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }
  function cancelHold() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setProgress(0);
  }

  const borderCol = color === "cyan" ? "rgba(0,212,255,0.35)" : color === "amber" ? "rgba(255,176,32,0.35)" : "rgba(255,69,96,0.35)";
  const bgCol     = color === "cyan" ? "rgba(0,212,255,0.08)" : color === "amber" ? "rgba(255,176,32,0.08)" : "rgba(255,69,96,0.08)";

  return (
    <button style={{
      position: "relative", overflow: "hidden",
      padding: "8px 18px", borderRadius: "var(--r-md)",
      border: `1px solid ${borderCol}`, background: bgCol,
      color: c, fontFamily: "var(--f-heading)", fontSize: 11, fontWeight: 700,
      letterSpacing: "0.08em", textTransform: "uppercase", cursor: disabled ? "not-allowed" : "pointer",
      outline: "none", opacity: disabled ? 0.4 : 1, minHeight: 36,
    }}
      onMouseDown={disabled ? undefined : startHold}
      onMouseUp={disabled ? undefined : cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={disabled ? undefined : startHold}
      onTouchEnd={disabled ? undefined : cancelHold}
      disabled={disabled}
    >
      <span style={{ position: "relative", zIndex: 1 }}>{progress > 0 ? `HOLD ${Math.round(progress)}%` : label}</span>
      <span style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(90deg, transparent, ${c})`,
        opacity: progress / 500,
        transform: `scaleX(${progress / 100})`,
        transformOrigin: "left",
      }} />
    </button>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const W = 80, H = 24;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - ((v - min) / range) * H}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Tank Mini Diagram (sensors section) ─────────────────────────────────────
function TankMiniDiagram({ activeStage }: { activeStage: Stage }) {
  return (
    <svg viewBox="0 0 160 200" width="100%" style={{ maxWidth: 160, display: "block" }}>
      <rect x="30" y="10" width="100" height="180" rx="4" fill="none" stroke="rgba(0,212,255,0.15)" strokeWidth="1.5" />
      <text x="80" y="8" textAnchor="middle" fill="rgba(0,212,255,0.5)" fontSize="7" fontFamily="Rajdhani">WATER IN</text>
      <rect x="30" y="15" width="100" height="60" fill="rgba(0,90,180,0.08)" />
      <text x="80" y="25" textAnchor="middle" fill="rgba(0,130,200,0.6)" fontSize="6" fontFamily="Rajdhani">EC CHAMBER</text>
      {[35, 44, 53, 62].map((y, i) => (
        <line key={i} x1="32" y1={y} x2="128" y2={y} stroke={i % 2 === 0 ? "#3a9eff" : "#1a6aaa"} strokeWidth="2" strokeOpacity="0.5" />
      ))}
      <rect x="30" y="78" width="100" height="10" fill="rgba(255,176,32,0.07)" />
      <line x1="32" y1="83" x2="128" y2="83" stroke="rgba(255,176,32,0.5)" strokeWidth="2.5" strokeDasharray="4 3" />
      <text x="135" y="86" fill="rgba(255,176,32,0.7)" fontSize="6" fontFamily="Rajdhani">GATE</text>
      {/* Sensor pod */}
      <rect x="30" y="92" width="100" height="16"
        fill={activeStage === "post_lamella" ? "rgba(0,212,255,0.12)" : "rgba(0,212,255,0.04)"}
        stroke={activeStage === "post_lamella" ? "rgba(0,212,255,0.55)" : "rgba(0,212,255,0.18)"}
        strokeWidth="1" rx="1" />
      <text x="80" y="103" textAnchor="middle"
        fill={activeStage === "post_lamella" ? "var(--cyan)" : "rgba(0,212,255,0.5)"} fontSize="7" fontFamily="Rajdhani">
        SENSOR POD {activeStage === "post_lamella" ? "← HERE" : ""}
      </text>
      {/* Pre-lamella indicator */}
      {activeStage === "pre_lamella" && (
        <rect x="30" y="106" width="100" height="6" fill="rgba(0,212,255,0.12)" stroke="rgba(0,212,255,0.55)" strokeWidth="1" rx="1" />
      )}
      <rect x="30" y="112" width="100" height="30" fill="rgba(0,255,178,0.04)" />
      <line x1="30" y1="142" x2="80" y2="112" stroke="rgba(0,255,178,0.35)" strokeWidth="1.5" />
      <line x1="130" y1="142" x2="80" y2="112" stroke="rgba(0,255,178,0.35)" strokeWidth="1.5" />
      <text x="80" y="130" textAnchor="middle" fill="rgba(0,255,178,0.5)" fontSize="6" fontFamily="Rajdhani">LAMELLA</text>
      <rect x="30" y="150" width="100" height="36" fill="rgba(0,40,100,0.15)" />
      <line x1="32" y1="166" x2="128" y2="166" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3 3" />
      <text x="80" y="161" textAnchor="middle" fill="rgba(0,212,255,0.35)" fontSize="6" fontFamily="Rajdhani">CLEAN</text>
      <text x="80" y="176" textAnchor="middle" fill="rgba(74,122,152,0.5)" fontSize="6" fontFamily="Rajdhani">SLUDGE</text>
      <circle cx="31" cy="178" r="3" fill="none" stroke="rgba(74,122,152,0.4)" strokeWidth="1" />
    </svg>
  );
}

// ─── Tank Full Diagram (tank section) ────────────────────────────────────────
function TankDiagram({ gateOpen, wqiScore, phase }: { gateOpen: boolean; wqiScore: number | null; phase: string }) {
  return (
    <svg viewBox="0 0 180 340" width="100%" style={{ maxWidth: 220, display: "block", margin: "0 auto" }}>
      <rect x="35" y="14" width="110" height="312" rx="6" fill="none" stroke="rgba(0,212,255,0.18)" strokeWidth="1.5" />
      <text x="90" y="10" textAnchor="middle" fill="rgba(0,212,255,0.7)" fontSize="7" fontFamily="Rajdhani" fontWeight="600">WATER IN ↓</text>
      {/* Propeller */}
      <rect x="35" y="16" width="110" height="28" fill="rgba(0,60,140,0.08)" />
      <line x1="40" y1="30" x2="140" y2="30" stroke="rgba(0,130,220,0.25)" strokeWidth="1" strokeDasharray="5 3" />
      <text x="90" y="28" textAnchor="middle" fill="rgba(0,150,220,0.55)" fontSize="6" fontFamily="Rajdhani">PROPELLER ZONE</text>
      {/* EC */}
      <rect x="35" y="46" width="110" height="90" fill="rgba(0,70,160,0.08)" />
      <text x="90" y="58" textAnchor="middle" fill="rgba(0,130,200,0.65)" fontSize="7" fontFamily="Rajdhani" fontWeight="600">EC CHAMBER</text>
      {[65, 74, 83, 92, 101, 110].map((y, i) => (
        <g key={y}>
          <line x1="37" y1={y} x2="143" y2={y} stroke={i % 2 === 0 ? "rgba(80,160,255,0.55)" : "rgba(40,100,200,0.45)"} strokeWidth="2" />
          <text x="146" y={y + 4} fill={i % 2 === 0 ? "rgba(80,160,255,0.55)" : "rgba(40,100,200,0.4)"} fontSize="5" fontFamily="JetBrains Mono">{i % 2 === 0 ? "+" : "−"}</text>
          {[50, 64, 78, 92, 106, 120, 134].map(x => (
            <circle key={x} cx={x} cy={y} r="1.2" fill="none" stroke="rgba(0,130,220,0.22)" strokeWidth="0.8" />
          ))}
        </g>
      ))}
      {/* Gate */}
      <rect x="35" y="140" width="110" height="14" fill="rgba(255,176,32,0.06)" />
      <line x1="37" y1="147" x2="143" y2="147"
        stroke={gateOpen ? "rgba(255,176,32,0.25)" : "rgba(255,176,32,0.70)"}
        strokeWidth="3" strokeDasharray={gateOpen ? "6 4" : undefined} />
      <text x="90" y="146" textAnchor="middle" fill="rgba(255,176,32,0.75)" fontSize="6" fontFamily="Rajdhani">
        TIMED GATE — {gateOpen ? "OPEN" : "CLOSED"}
      </text>
      {/* Sensor pod */}
      <rect x="35" y="158" width="110" height="18" fill="rgba(0,212,255,0.10)" stroke="rgba(0,212,255,0.50)" strokeWidth="1" rx="2" />
      <text x="90" y="170" textAnchor="middle" fill="var(--cyan)" fontSize="7" fontFamily="Rajdhani" fontWeight="700">◆ SENSOR POD</text>
      <text x="150" y="168" fill="rgba(0,212,255,0.45)" fontSize="5" fontFamily="Rajdhani">pH·NTU·TDS</text>
      {/* Lamella */}
      <rect x="35" y="180" width="110" height="48" fill="rgba(0,255,178,0.04)" />
      <line x1="35" y1="228" x2="90" y2="180" stroke="rgba(0,255,178,0.40)" strokeWidth="1.5" />
      <line x1="145" y1="228" x2="90" y2="180" stroke="rgba(0,255,178,0.40)" strokeWidth="1.5" />
      <text x="90" y="208" textAnchor="middle" fill="rgba(0,255,178,0.55)" fontSize="6" fontFamily="Rajdhani">LAMELLA</text>
      <text x="90" y="220" textAnchor="middle" fill="rgba(0,255,178,0.30)" fontSize="5" fontFamily="Rajdhani">V-settle 45°+10%+45°</text>
      {/* Collection */}
      <rect x="35" y="232" width="110" height="90" fill="rgba(0,25,70,0.15)" />
      <line x1="37" y1="275" x2="143" y2="275" stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="3 3" />
      <text x="90" y="263" textAnchor="middle"
        fill={wqiScore != null && wqiScore >= 65 ? "rgba(0,212,255,0.55)" : "rgba(0,212,255,0.25)"}
        fontSize="6" fontFamily="Rajdhani">CLEAN WATER</text>
      <text x="90" y="290" textAnchor="middle" fill="rgba(74,122,152,0.45)" fontSize="6" fontFamily="Rajdhani">HEAVY SLUDGE</text>
      <text x="90" y="312" textAnchor="middle" fill="rgba(0,212,255,0.30)" fontSize="7" fontFamily="Rajdhani">COLLECTION ZONE</text>
      <circle cx="36" cy="308" r="4" fill="none" stroke="rgba(74,122,152,0.45)" strokeWidth="1.2" />
      <text x="31" y="322" fill="rgba(74,122,152,0.4)" fontSize="5" fontFamily="Rajdhani">plug</text>
      {/* Phase label */}
      <text x="90" y="332" textAnchor="middle"
        fill={PHASE_COLORS[phase as Phase] ?? "var(--text-dim)"}
        fontSize="6" fontFamily="JetBrains Mono" letterSpacing="0.08em">
        {phase.replace(/_/g, " ")}
      </text>
    </svg>
  );
}

// ─── Threshold helpers ────────────────────────────────────────────────────────
function ThresholdSlider({ label, value, min, max, step, desc, onChange, onReset, warn }: {
  label: string; value: number; min: number; max: number; step: number;
  desc: string; onChange: (v: number) => void; onReset: () => void; warn?: boolean;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid rgba(0,212,255,0.07)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--f-mono)", fontSize: 10, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.04em" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="t-mono" style={{ fontSize: 12, color: warn ? "var(--amber)" : "var(--cyan)" }}>{value}</span>
          <button className="btn btn-ghost" style={{ fontSize: 8, padding: "2px 7px", minHeight: "unset" }} onClick={onReset}>reset</button>
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        style={{
          width: "100%", height: 4, borderRadius: 2, outline: "none", border: "none",
          cursor: "pointer", appearance: "none", marginTop: 8,
          background: `linear-gradient(to right, var(--cyan) ${pct}%, rgba(0,212,255,0.15) ${pct}%)`,
        } as React.CSSProperties}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
      <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 3, fontFamily: "var(--f-heading)", lineHeight: 1.4 }}>{desc}</div>
      {warn && <div style={{ fontSize: 9, color: "var(--amber)", marginTop: 2, fontFamily: "var(--f-mono)" }}>⚠ Aggressive correction — use with caution</div>}
    </div>
  );
}
function ThresholdInput({ label, value, step, decimals, desc, onChange, onReset }: {
  label: string; value: number; step: number; decimals: number;
  desc: string; onChange: (v: number) => void; onReset: () => void;
}) {
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid rgba(0,212,255,0.07)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontFamily: "var(--f-mono)", fontSize: 10, fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
        <button className="btn btn-ghost" style={{ fontSize: 8, padding: "2px 7px", minHeight: "unset" }} onClick={onReset}>reset</button>
      </div>
      <input type="number" step={step} value={value.toFixed(decimals)}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          width: 120, background: "var(--bg-inset)", border: "1px solid rgba(0,212,255,0.18)",
          borderRadius: "var(--r-md)", padding: "6px 10px",
          fontFamily: "var(--f-mono)", fontSize: 12, color: "var(--text-primary)", outline: "none",
        }}
      />
      <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 4, fontFamily: "var(--f-heading)", lineHeight: 1.4 }}>{desc}</div>
    </div>
  );
}

// ─── Right Rail ───────────────────────────────────────────────────────────────
function LivePulse({ status, prediction, batchSize, syncing, onSync, lastSync, railFlash }: {
  status: SysStatus | null; prediction: Prediction | null; batchSize: number;
  syncing: boolean; onSync: () => void; lastSync: Date | null; railFlash: boolean;
}) {
  const phase = (status?.phase ?? "IDLE") as Phase;
  const wqi   = prediction?.wqi?.score ?? null;

  return (
    <div style={{
      position: "sticky", top: 68,
      background: "var(--bg-glass)", border: `1px solid ${railFlash ? "rgba(0,212,255,0.55)" : "var(--border)"}`,
      borderRadius: "var(--r-xl)", overflow: "hidden",
      backdropFilter: "blur(var(--glass-blur))",
      boxShadow: railFlash ? "var(--glass-shadow), 0 0 24px rgba(0,212,255,0.18)" : "var(--glass-shadow)",
      transition: "border-color 0.4s ease, box-shadow 0.4s ease",
    }}>
      {/* Header */}
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontFamily: "var(--f-display)", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", color: "var(--text-secondary)" }}>SYSTEM PULSE</span>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--f-mono)", fontSize: 9, fontWeight: 600, color: status?.online !== false ? "var(--emerald)" : "var(--red)" }}>
          <span className="dot" style={{
            background: status?.online !== false ? "var(--emerald)" : "var(--red)",
            boxShadow: status?.online !== false ? "0 0 6px var(--emerald)" : "none",
            animation: status?.online !== false ? "pulseDot 1.6s ease-in-out infinite" : "none",
          }} />
          {status?.online !== false ? "RENDER LIVE" : "OFFLINE"}
          {status?.latencyMs != null && <span style={{ color: "var(--text-dim)", fontSize: 9 }}>&nbsp;{status.latencyMs}ms</span>}
        </div>
      </div>
      {/* Phase */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
        <div className="t-label" style={{ marginBottom: 6 }}>PHASE</div>
        <div style={{
          display: "inline-flex", alignItems: "center", padding: "4px 10px",
          borderRadius: 5, fontFamily: "var(--f-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
          color: PHASE_COLORS[phase], background: PHASE_BG[phase],
        }}>{phase.replace(/_/g, " ")}</div>
      </div>
      {/* Readings */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
        <div className="t-label" style={{ marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
          <span>READINGS</span>
          <span className="t-mono" style={{ color: "var(--cyan)", fontSize: 11 }}>{status?.collected ?? 0} / {batchSize}</span>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {Array.from({ length: batchSize }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 5, borderRadius: 2,
              background: i < (status?.collected ?? 0) ? "var(--cyan)" : "rgba(0,212,255,0.10)",
              border: `1px solid ${i < (status?.collected ?? 0) ? "var(--cyan)" : "rgba(0,212,255,0.14)"}`,
              boxShadow: i < (status?.collected ?? 0) ? "0 0 6px rgba(0,212,255,0.4)" : "none",
              transition: "background 0.4s ease",
            }} />
          ))}
        </div>
      </div>
      {/* WQI */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", textAlign: "center" }}>
        <div className="t-label" style={{ marginBottom: 8 }}>LAST WQI</div>
        {wqi != null ? (
          <>
            <svg width="80" height="50" viewBox="0 0 80 50" style={{ overflow: "visible", display: "block", margin: "0 auto" }}>
              <path d="M 8 46 A 36 36 0 0 1 72 46" fill="none" stroke="rgba(0,212,255,0.12)" strokeWidth="4" strokeLinecap="round" />
              <path d="M 8 46 A 36 36 0 0 1 72 46" fill="none" stroke={wqiColor(wqi)} strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${(wqi / 100) * 113} 113`} style={{ transition: "stroke-dasharray 0.6s ease" }} />
              <text x="40" y="44" textAnchor="middle" fill={wqiColor(wqi)} style={{ font: "700 18px 'JetBrains Mono'" }}>{Math.round(wqi)}</text>
            </svg>
            <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 2, fontFamily: "var(--f-mono)", letterSpacing: "0.06em" }}>
              {prediction?.wqi?.interpretation?.toUpperCase()}
            </div>
          </>
        ) : (
          <div style={{ color: "var(--text-dim)", fontSize: 11, fontFamily: "var(--f-mono)" }}>NO DATA</div>
        )}
      </div>
      {/* Sync */}
      <div style={{ padding: "10px 12px" }}>
        <button className="btn btn-ghost" style={{ width: "100%", fontSize: 10, padding: "7px 10px" }} onClick={onSync} disabled={syncing}>
          {syncing ? "SYNCING…" : "⟳  SYNC NOW"}
        </button>
        {lastSync && (
          <div style={{ fontSize: 9, color: "var(--text-dim)", fontFamily: "var(--f-mono)", marginTop: 6, textAlign: "center" }}>
            {lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section Components ───────────────────────────────────────────────────────

function SectionSystem({ status, batchSize, setBatchSize, onStatusUpdate, backendUrl }: {
  status: SysStatus | null; batchSize: number; setBatchSize: (n: number) => void;
  onStatusUpdate: () => void; backendUrl: string;
}) {
  const [url, setUrl] = useState(() => localStorage.getItem("wiq_backend_url") ?? DEFAULT_URL);
  const [env, setEnv] = useState<Env>("Development");
  const [testResult, setTestResult] = useState<null | { ok: boolean; msg: string }>(null);
  const [testing, setTesting] = useState(false);
  const [prodConfirm, setProdConfirm] = useState(false);
  const [sessionMsg, setSessionMsg] = useState<string | null>(null);
  const phase = status?.phase ?? "IDLE";
  const phaseOk = phase === "IDLE" || phase === "COLLECTING";

  async function testConn() {
    setTesting(true); setTestResult(null);
    const t0 = Date.now();
    try {
      const r = await fetch(`${url}/session/status`);
      const ms = Date.now() - t0;
      if (r.ok) {
        const d = await r.json();
        setTestResult({ ok: true, msg: `${ms}ms · phase: ${d.phase}` });
      } else { setTestResult({ ok: false, msg: `HTTP ${r.status}` }); }
    } catch (e: unknown) { setTestResult({ ok: false, msg: `Network error · ${e instanceof Error ? e.message : String(e)}` }); }
    setTesting(false);
  }

  async function doCmd(cmd: "start" | "reset") {
    try {
      const r = await fetch(`${url}/${cmd === "start" ? "session/start" : "session/reset"}`, { method: "POST" });
      const d = await r.json();
      setSessionMsg(d.message ?? d.phase ?? "OK");
      onStatusUpdate();
    } catch { setSessionMsg("Request failed"); }
    setTimeout(() => setSessionMsg(null), 3000);
  }

  return (
    <div>
      {/* Endpoint */}
      <div className="s-block">
        <div className="s-label">BACKEND ENDPOINT</div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "var(--bg-inset)", border: "1px solid rgba(0,212,255,0.18)",
          borderRadius: "var(--r-md)", padding: "8px 12px",
        }}>
          <span style={{ fontFamily: "var(--f-mono)", fontSize: 12, color: "var(--cyan)", flexShrink: 0 }}>$</span>
          <input type="text" value={url} spellCheck={false}
            onChange={e => setUrl(e.target.value)}
            onBlur={() => localStorage.setItem("wiq_backend_url", url)}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--text-primary)", caretColor: "var(--cyan)",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-cyan" style={{ fontSize: 10 }} onClick={testConn} disabled={testing}>
            {testing ? "TESTING…" : "TEST CONNECTION"}
          </button>
          {testResult && (
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 10, color: testResult.ok ? "var(--emerald)" : "var(--red)" }}>
              {testResult.ok ? "✓" : "✗"} {testResult.msg}
            </span>
          )}
        </div>
      </div>

      {/* Environment */}
      <div className="s-block">
        <div className="s-label">DEPLOYMENT ENVIRONMENT</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {(["Development", "Staging", "Production"] as Env[]).map(e => (
            <button key={e} onClick={() => { if (e === "Production") setProdConfirm(true); else { setEnv(e); setProdConfirm(false); } }}
              style={{
                padding: "6px 14px", borderRadius: "var(--r-md)",
                border: `1px solid ${env === e ? (e === "Production" ? "rgba(255,176,32,0.55)" : "rgba(0,212,255,0.40)") : "var(--border)"}`,
                background: env === e ? (e === "Production" ? "rgba(255,176,32,0.10)" : "rgba(0,212,255,0.08)") : "transparent",
                color: env === e ? (e === "Production" ? "var(--amber)" : "var(--cyan)") : "var(--text-secondary)",
                fontFamily: "var(--f-heading)", fontSize: 11, fontWeight: 600, cursor: "pointer", outline: "none",
              }}>{e}</button>
          ))}
        </div>
        {prodConfirm && (
          <div style={{ marginTop: 8, background: "rgba(255,176,32,0.05)", border: "1px solid rgba(255,176,32,0.18)", borderRadius: "var(--r-md)", padding: "8px 12px" }}>
            <div style={{ fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--amber)" }}>
              ⚠ You are configuring the live system. Changes affect physical hardware.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button className="btn btn-ghost" style={{ fontSize: 9 }} onClick={() => { setEnv("Production"); setProdConfirm(false); }}>CONFIRM</button>
              <button className="btn btn-ghost" style={{ fontSize: 9 }} onClick={() => setProdConfirm(false)}>CANCEL</button>
            </div>
          </div>
        )}
      </div>

      {/* Batch size */}
      <div className="s-block">
        <div className="s-label">BATCH SIZE <span style={{ color: "var(--text-dim)", fontWeight: 400, fontSize: 9 }}>BATCH_SIZE constant</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setBatchSize(Math.max(3, batchSize - 1))}
            disabled={batchSize <= 3 || phase !== "IDLE"}
            style={{ width: 30, height: 30, borderRadius: "var(--r-sm)", border: "1px solid var(--border-mid)", background: "rgba(0,212,255,0.06)", color: "var(--cyan)", fontSize: 16, fontWeight: 700, cursor: "pointer", outline: "none", opacity: (batchSize <= 3 || phase !== "IDLE") ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
          <span className="t-mono" style={{ fontSize: 20, color: "var(--cyan)", minWidth: 24, textAlign: "center" }}>{batchSize}</span>
          <button onClick={() => setBatchSize(Math.min(10, batchSize + 1))}
            disabled={batchSize >= 10 || phase !== "IDLE"}
            style={{ width: 30, height: 30, borderRadius: "var(--r-sm)", border: "1px solid var(--border-mid)", background: "rgba(0,212,255,0.06)", color: "var(--cyan)", fontSize: 16, fontWeight: 700, cursor: "pointer", outline: "none", opacity: (batchSize >= 10 || phase !== "IDLE") ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
          <span style={{ fontSize: 9, color: "var(--text-dim)", fontFamily: "var(--f-mono)" }}>readings / batch</span>
        </div>
        <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 6, fontFamily: "var(--f-heading)" }}>
          Readings required before /analyze-water is permitted. Changing this resets the current session.
        </div>
        {phase !== "IDLE" && <div style={{ fontSize: 9, color: "var(--amber)", marginTop: 4, fontFamily: "var(--f-mono)" }}>🔒 Disabled — phase must be IDLE</div>}
      </div>

      {/* Session controls */}
      <div className="s-block">
        <div className="s-label">SESSION CONTROLS</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btn-ghost" style={{ fontSize: 10 }} disabled={!phaseOk} onClick={() => doCmd("start")}>
            START NEW SESSION
          </button>
          <HoldButton label="⚠ HARD RESET" color="red" disabled={!phaseOk} onConfirm={() => doCmd("reset")} />
        </div>
        {sessionMsg && <div style={{ marginTop: 8, fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--cyan)" }}>{sessionMsg}</div>}
        {!phaseOk && <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 4, fontFamily: "var(--f-mono)" }}>Available in IDLE or COLLECTING only</div>}
      </div>
    </div>
  );
}

function SectionIntelligence({ prediction, fingerprints, thresholds, setThresholds }: {
  prediction: Prediction | null; fingerprints: Fingerprint[];
  thresholds: Thresholds; setThresholds: (t: Thresholds) => void;
}) {
  const flatlineAny = prediction?.flatline?.anyFlatlined ?? false;
  const failsafe    = prediction?.flatline?.failsafeTriggered ?? false;
  const layers = [
    { n: "01", name: "Composite WQI",              desc: "Stage-aware weighting of pH·turbidity·TDS into 0–100 score" },
    { n: "02", name: "Confidence Analysis",         desc: "Cross-sensor agreement — drives physical re-treatment recommendation" },
    { n: "03", name: "Flatline Detection",          desc: "Sensor death detection — triggers safety failsafe on failure", flatline: true },
    { n: "04", name: "Cross-Sensor Recalibration",  desc: "Uses TDS+pH as ground truth to auto-correct turbidity sensor" },
    { n: "05", name: "Cycle Fingerprinting",        desc: "Captures slope shape per cycle, detects anomalies vs history" },
    { n: "06", name: "Stage-Aware Classification",  desc: "pre_lamella / post_lamella context changes WQI weights and notes" },
  ];
  const anomalyTrend = fingerprints.length >= 3
    ? (fingerprints.slice(-3).reduce((a, f) => a + f.anomalyScore, 0) / 3).toFixed(3)
    : null;
  function reset(k: keyof Thresholds) { setThresholds({ ...thresholds, [k]: THRESHOLDS_DEFAULT[k] }); }

  return (
    <div>
      {/* Layer status */}
      <div className="s-block">
        <div className="s-label">INTELLIGENCE LAYER STATUS</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {layers.map(l => {
            const isBypassed = failsafe && l.n !== "03";
            const highlight = l.flatline && flatlineAny;
            const danger    = l.flatline && failsafe;
            return (
              <div key={l.n} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                borderRadius: "var(--r-sm)",
                background: danger ? "rgba(255,69,96,0.08)" : highlight ? "rgba(255,176,32,0.07)" : "rgba(0,0,0,0.15)",
                border: `1px solid ${danger ? "rgba(255,69,96,0.25)" : highlight ? "rgba(255,176,32,0.22)" : "transparent"}`,
              }}>
                <span style={{ fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--text-dim)", minWidth: 20 }}>{l.n}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontFamily: "var(--f-heading)", fontSize: 12, fontWeight: 700, color: "var(--text-primary)", display: "block" }}>{l.name}</span>
                  <span style={{ fontFamily: "var(--f-heading)", fontSize: 10, color: "var(--text-secondary)", display: "block" }}>{l.desc}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {danger && <span className="dot" style={{ background: "var(--red)", animation: "statusBlink 1s infinite" }} />}
                  <span className={`badge ${isBypassed ? "badge-red" : "badge-cyan"}`}>{isBypassed ? "BYPASSED" : "ACTIVE"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Thresholds */}
      <div className="s-block">
        <div className="s-label">TUNABLE THRESHOLDS</div>
        <ThresholdSlider label="FLATLINE_WINDOW" value={thresholds.flatlineWindow} min={2} max={8} step={1}
          desc="Number of consecutive readings checked for sensor death. Lower = faster detection. Higher = fewer false positives."
          onChange={v => setThresholds({ ...thresholds, flatlineWindow: v })} onReset={() => reset("flatlineWindow")} />
        <ThresholdInput label="FLATLINE_EPSILON" value={thresholds.flatlineEpsilon} step={0.001} decimals={3}
          desc="Maximum delta allowed before a sensor is flagged as flatlined. Below this value across all window readings = sensor dead."
          onChange={v => setThresholds({ ...thresholds, flatlineEpsilon: v })} onReset={() => reset("flatlineEpsilon")} />
        <ThresholdSlider label="RECAL_DISAGREEMENT_THRESHOLD" value={thresholds.recalThreshold} min={0.1} max={0.8} step={0.05}
          desc="Normalised disagreement score between turbidity and the TDS+pH ground truth that triggers auto-correction. Lower = more aggressive."
          onChange={v => setThresholds({ ...thresholds, recalThreshold: v })} onReset={() => reset("recalThreshold")} />
        <ThresholdSlider label="RECAL_CORRECTION_FACTOR" value={thresholds.correctionFactor} min={0.70} max={0.99} step={0.01}
          desc="Scale factor applied to turbidity when recalibration fires. 0.88 = 12% correction. Values below 0.80 are aggressive — use with caution."
          onChange={v => setThresholds({ ...thresholds, correctionFactor: v })} onReset={() => reset("correctionFactor")}
          warn={thresholds.correctionFactor < 0.80} />
      </div>

      {/* WQI weight visualiser */}
      <div className="s-block">
        <div className="s-label">WQI STAGE WEIGHT DISTRIBUTION</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {(["post_lamella", "pre_lamella"] as const).map(s => {
            const weights = s === "post_lamella"
              ? [{ lbl: "pH", w: 25, c: "var(--cyan)" }, { lbl: "Turbidity", w: 50, c: "var(--emerald)" }, { lbl: "TDS", w: 25, c: "var(--amber)" }]
              : [{ lbl: "pH", w: 20, c: "var(--cyan)" }, { lbl: "Turbidity", w: 30, c: "var(--emerald)" }, { lbl: "TDS", w: 50, c: "var(--amber)" }];
            const isActive = prediction?.stageAware?.stage === s;
            return (
              <div key={s} style={{
                background: "var(--bg-inset)", padding: "10px 12px",
                border: `1px solid ${isActive ? "var(--cyan)" : "var(--border)"}`, borderRadius: "var(--r-md)",
                transition: "border-color 0.3s ease",
              }}>
                <div style={{ fontSize: 9, fontFamily: "var(--f-mono)", letterSpacing: "0.08em", marginBottom: 8, color: isActive ? "var(--cyan)" : "var(--text-secondary)" }}>
                  {s.replace("_", " ").toUpperCase()} {isActive && "← ACTIVE"}
                </div>
                {weights.map(w => (
                  <div key={w.lbl} style={{ marginBottom: 5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 9, fontFamily: "var(--f-heading)", color: w.c }}>{w.lbl}</span>
                      <span style={{ fontSize: 9, fontFamily: "var(--f-mono)", color: w.c }}>{w.w}%</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2 }}>
                      <div style={{ width: `${w.w}%`, height: "100%", background: w.c, borderRadius: 2, opacity: 0.8 }} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fingerprint history */}
      <div className="s-block">
        <div className="s-label">CYCLE FINGERPRINT HISTORY</div>
        {fingerprints.length === 0 ? (
          <div style={{ color: "var(--text-dim)", fontSize: 11, fontFamily: "var(--f-mono)", padding: "12px 0" }}>
            No fingerprints yet. Run a treatment cycle.
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>{["CYCLE ID","DURATION","pH Δ","TURB Δ","TDS Δ","ANOMALY","FLAGS"].map(h => (
                    <th key={h} style={{ fontFamily: "var(--f-mono)", fontSize: 8, letterSpacing: "0.1em", color: "var(--text-dim)", textAlign: "left", padding: "5px 8px", borderBottom: "1px solid var(--border)" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {fingerprints.slice(-5).map(fp => (
                    <tr key={fp.cycleId}>
                      <td style={{ fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--text-secondary)", padding: "6px 8px", borderBottom: "1px solid rgba(0,212,255,0.05)" }}>{fp.cycleId.slice(0, 8)}…</td>
                      <td style={{ fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--text-secondary)", padding: "6px 8px", borderBottom: "1px solid rgba(0,212,255,0.05)" }}>{(fp.durationMs/1000).toFixed(1)}s</td>
                      <td style={{ fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--cyan)", padding: "6px 8px", borderBottom: "1px solid rgba(0,212,255,0.05)" }}>{fp.phSlope.toFixed(3)}</td>
                      <td style={{ fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--emerald)", padding: "6px 8px", borderBottom: "1px solid rgba(0,212,255,0.05)" }}>{fp.turbiditySlope.toFixed(3)}</td>
                      <td style={{ fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--amber)", padding: "6px 8px", borderBottom: "1px solid rgba(0,212,255,0.05)" }}>{fp.tdsSlope.toFixed(3)}</td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid rgba(0,212,255,0.05)", verticalAlign: "middle" }}>
                        <div style={{ width: 50, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginBottom: 2 }}>
                          <div style={{ width: `${fp.anomalyScore*100}%`, height: "100%", borderRadius: 2, background: fp.anomalyScore > 0.75 ? "var(--red)" : fp.anomalyScore > 0.4 ? "var(--amber)" : "var(--emerald)" }} />
                        </div>
                        <span style={{ fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--text-secondary)" }}>{fp.anomalyScore.toFixed(2)}</span>
                      </td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid rgba(0,212,255,0.05)" }}>
                        {fp.anomalyFlags.map(f => <span key={f} className="badge badge-amber" style={{ fontSize: 7, marginRight: 2 }}>{f.replace(/_/g, " ").slice(0, 14)}</span>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {anomalyTrend && (
              <div style={{ marginTop: 8, fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--text-secondary)" }}>
                3-cycle anomaly trend: <span style={{ color: parseFloat(anomalyTrend) > 0.5 ? "var(--red)" : "var(--emerald)" }}>{anomalyTrend}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SectionSensors({ prediction, readings, stage, setStage, thresholds }: {
  prediction: Prediction | null;
  readings: { ph: number; turbidity: number; tds: number }[];
  stage: Stage; setStage: (s: Stage) => void; thresholds: Thresholds;
}) {
  const flatline = prediction?.flatline;
  const conf     = prediction?.confidence;
  const recal    = prediction?.recalibration;
  const sensors = [
    { key: "ph" as const,        label: "pH",       unit: "pH",  dead: flatline?.ph ?? false,        color: "var(--cyan)"    },
    { key: "turbidity" as const, label: "Turbidity",unit: "NTU", dead: flatline?.turbidity ?? false,  color: "var(--emerald)" },
    { key: "tds" as const,       label: "TDS",      unit: "ppm", dead: flatline?.tds ?? false,        color: "var(--amber)"   },
  ];
  const recalDelta = recal?.triggered && recal.originalTurbidity && recal.correctedTurbidity
    ? (((recal.correctedTurbidity - recal.originalTurbidity) / recal.originalTurbidity) * 100).toFixed(1)
    : null;
  const recCols: Record<string, string> = { proceed: "var(--cyan)", extend_ec_cycle: "var(--amber)", re_run_cycle: "#f97316", discard: "var(--red)" };

  return (
    <div>
      {/* Health cards */}
      <div className="s-block">
        <div className="s-label">SENSOR HEALTH</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {sensors.map(s => {
            const last = readings.length > 0 ? (readings[readings.length - 1] as Record<string, number>)[s.key] : null;
            const vals = readings.slice(-5).map(r => (r as Record<string, number>)[s.key] ?? 0);
            return (
              <div key={s.key} style={{
                background: "var(--bg-inset)", border: `1px solid ${s.dead ? "rgba(255,69,96,0.35)" : "var(--border)"}`,
                borderRadius: "var(--r-md)", padding: "10px 12px", transition: "border-color 0.3s ease",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontFamily: "var(--f-heading)", fontWeight: 700, fontSize: 12, color: s.color }}>{s.label}</span>
                  <span className={`badge ${s.dead ? "badge-red" : "badge-emerald"}`} style={{ fontSize: 8 }}>
                    {s.dead && <span className="dot" style={{ background: "var(--red)", animation: "pulseDot 1s infinite", width: 5, height: 5 }} />}
                    {s.dead ? "FLATLINED" : "LIVE"}
                  </span>
                </div>
                <div className="t-mono" style={{ fontSize: 18, color: s.dead ? "var(--red)" : s.color, marginBottom: 6 }}>
                  {last != null ? last.toFixed(2) : "—"}&nbsp;<span style={{ fontSize: 9, color: "var(--text-dim)" }}>{s.unit}</span>
                </div>
                {vals.length > 1 && <Sparkline values={vals} color={s.dead ? "var(--red)" : s.color} />}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 9, color: "var(--text-dim)", fontFamily: "var(--f-mono)", marginTop: 8 }}>
          Flatline if delta ≤ {thresholds.flatlineEpsilon} across {thresholds.flatlineWindow} consecutive readings
        </div>
      </div>

      {/* Agreement */}
      {conf && (
        <div className="s-block">
          <div className="s-label">CROSS-SENSOR AGREEMENT</div>
          {[
            { lbl: "pH ↔ Turbidity", val: conf.phTurbidityAgreement },
            { lbl: "pH ↔ TDS",       val: conf.phTdsAgreement },
            { lbl: "Turbidity ↔ TDS",val: conf.turbidityTdsAgreement },
          ].map(p => (
            <div key={p.lbl} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontFamily: "var(--f-heading)", color: "var(--text-secondary)" }}>{p.lbl}</span>
                <span className="t-mono" style={{ fontSize: 10, color: agreementColor(p.val) }}>{p.val.toFixed(2)}</span>
              </div>
              <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3 }}>
                <div style={{ width: `${p.val * 100}%`, height: "100%", background: agreementColor(p.val), borderRadius: 3, transition: "width 0.6s ease" }} />
              </div>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <span style={{ fontSize: 11, fontFamily: "var(--f-heading)", color: "var(--text-secondary)" }}>
              Overall: <span className="t-mono" style={{ color: agreementColor(conf.score) }}>{conf.score.toFixed(2)}</span>
            </span>
            <span className="badge badge-cyan">{conf.level.toUpperCase()}</span>
            <span className="badge" style={{ color: recCols[conf.recommendation] ?? "var(--cyan)", borderColor: recCols[conf.recommendation] ?? "var(--cyan)", background: "transparent" }}>
              {conf.recommendation.replace(/_/g, " ").toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Recalibration log */}
      <div className="s-block">
        <div className="s-label">RECALIBRATION LOG</div>
        {!recal
          ? <div style={{ color: "var(--text-dim)", fontSize: 11, fontFamily: "var(--f-mono)" }}>No analysis data yet.</div>
          : !recal.triggered
          ? <div style={{ color: "var(--emerald)", fontSize: 11, fontFamily: "var(--f-mono)" }}>✓ Last cycle: no correction applied.</div>
          : <div style={{ fontFamily: "var(--f-mono)", fontSize: 11 }}>
              <span style={{ color: "var(--amber)" }}>⚡ CORRECTION APPLIED</span>
              <div style={{ marginTop: 6, color: "var(--text-secondary)" }}>
                {recal.originalTurbidity?.toFixed(1)} NTU → <span style={{ color: "var(--cyan)" }}>{recal.correctedTurbidity?.toFixed(1)} NTU</span>
                {recalDelta && <span style={{ color: parseFloat(recalDelta) < 0 ? "var(--emerald)" : "var(--red)" }}> ({parseFloat(recalDelta) > 0 ? "+" : ""}{recalDelta}%)</span>}
              </div>
              <div style={{ marginTop: 4, fontSize: 9, color: "var(--text-dim)" }}>
                disagreement: {recal.disagreementScore.toFixed(3)} · {recal.reason}
              </div>
            </div>
        }
      </div>

      {/* Stage selector */}
      <div className="s-block">
        <div className="s-label">SENSOR POD STAGE</div>
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {(["pre_lamella", "post_lamella"] as Stage[]).map(s => (
            <button key={s} onClick={() => { setStage(s); localStorage.setItem("wiq_stage", s); }}
              style={{
                padding: "6px 14px", borderRadius: "var(--r-md)",
                border: `1px solid ${stage === s ? "rgba(0,212,255,0.40)" : "var(--border)"}`,
                background: stage === s ? "rgba(0,212,255,0.08)" : "transparent",
                color: stage === s ? "var(--cyan)" : "var(--text-secondary)",
                fontFamily: "var(--f-heading)", fontSize: 11, fontWeight: 600, cursor: "pointer", outline: "none",
              }}>{s.replace("_", " ")}</button>
          ))}
        </div>
        <div style={{ fontSize: 9, color: "var(--text-secondary)", fontFamily: "var(--f-heading)", marginBottom: 10 }}>
          Affects WQI weight distribution and contextual notes. Match to your sensor pod position.
        </div>
        <TankMiniDiagram activeStage={stage} />
      </div>
    </div>
  );
}

function SectionTank({ status, prediction, backendUrl }: {
  status: SysStatus | null; prediction: Prediction | null; backendUrl: string;
}) {
  const phase    = status?.phase ?? "IDLE";
  const gateOpen = phase === "TRANSFERRING_MAIN" || phase === "ANALYZED" || phase === "COMPLETE";
  const wqi      = prediction?.wqi?.score ?? null;
  const [pumpState, setPumpState] = useState<Record<string, string>>({});
  const [confirmPump, setConfirmPump] = useState<string | null>(null);

  async function sendPump(cmd: string) {
    setPumpState(p => ({ ...p, [cmd]: "pending" }));
    try {
      await fetch(`${backendUrl}/pump/command`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
      setPumpState(p => ({ ...p, [cmd]: "sent" }));
    } catch { setPumpState(p => ({ ...p, [cmd]: "error" })); }
    setTimeout(() => setPumpState(p => { const n = { ...p }; delete n[cmd]; return n; }), 30000);
  }

  const brackets = [
    { id: "F1", turb: "≤ 10 NTU",  tds: "< 1000 ppm",    desc: "Sediment + Carbon",    out: "Route to reuse",        c: "var(--cyan)"    },
    { id: "F2", turb: "10–30 NTU", tds: "< 1000 ppm",    desc: "Sand + Carbon",         out: "Route to reuse",        c: "var(--emerald)" },
    { id: "F3", turb: "> 30 NTU",  tds: "< 1000 ppm",    desc: "Coagulation + Sand",    out: "Treat further",         c: "var(--amber)"   },
    { id: "F4", turb: "—",         tds: "1000–1500 ppm",  desc: "Advanced treatment",   out: "Discard recommended",   c: "#f97316"        },
    { id: "F5", turb: "—",         tds: "> 1500 ppm",     desc: "RO / Disposal",         out: "Hard discard",          c: "var(--red)"     },
  ];

  return (
    <div>
      {/* Diagram */}
      <div className="s-block">
        <div className="s-label">TANK CROSS-SECTION</div>
        <TankDiagram gateOpen={gateOpen} wqiScore={wqi} phase={phase} />
      </div>

      {/* EC timer */}
      <div className="s-block">
        <div className="s-label">EC CYCLE TIMER <span style={{ color: "var(--text-dim)", fontWeight: 400, fontSize: 9 }}>firmware-controlled · read-only</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: 0.5 }}>
          <span style={{ fontSize: 12 }}>🔒</span>
          <input type="number" defaultValue={15} min={5} max={30} disabled
            style={{ width: 70, background: "var(--bg-inset)", border: "1px solid rgba(0,212,255,0.10)", borderRadius: "var(--r-md)", padding: "6px 10px", fontFamily: "var(--f-mono)", fontSize: 12, color: "var(--text-primary)", outline: "none", cursor: "not-allowed" }} />
          <span style={{ fontSize: 10, fontFamily: "var(--f-heading)", color: "var(--text-secondary)" }}>minutes minimum EC contact</span>
        </div>
        <div style={{ fontSize: 9, color: "var(--text-dim)", fontFamily: "var(--f-heading)", marginTop: 5 }}>
          Maps to ESP32 gate timer. Adjust in firmware.
        </div>
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, opacity: 0.5 }}>
          <span style={{ fontSize: 12 }}>🔒</span>
          <span style={{ fontSize: 10, fontFamily: "var(--f-heading)", color: "var(--text-dim)" }}>Polarity reversal: every 2–3 min (firmware)</span>
        </div>
      </div>

      {/* Pump commands */}
      <div className="s-block">
        <div className="s-label">PUMP COMMAND PANEL</div>
        {phase !== "ANALYZED" && (
          <div style={{ fontSize: 9, color: "var(--text-dim)", fontFamily: "var(--f-mono)", marginBottom: 8 }}>
            Available in ANALYZED phase only — current: <span style={{ color: PHASE_COLORS[phase as Phase] }}>{phase}</span>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { cmd: "START_PUMP_A", lbl: "PUMP A — REUSE",    c: "var(--cyan)",          confirm: true },
            { cmd: "START_PUMP_B", lbl: "PUMP B — DISCARD",  c: "var(--red)",            confirm: true },
            { cmd: "START_PUMP_C", lbl: "PUMP C — RE-TREAT", c: "var(--amber)",          confirm: false },
            { cmd: "STOP_ALL",     lbl: "STOP ALL",          c: "var(--text-secondary)", confirm: false },
          ].map(p => (
            <div key={p.cmd}>
              <button onClick={() => p.confirm ? setConfirmPump(p.cmd) : sendPump(p.cmd)}
                disabled={phase !== "ANALYZED"}
                style={{
                  width: "100%", padding: "9px 10px", borderRadius: "var(--r-md)",
                  border: `1px solid ${phase === "ANALYZED" ? `${p.c}55` : "var(--border)"}`,
                  background: phase === "ANALYZED" ? `${p.c}14` : "rgba(255,255,255,0.02)",
                  color: phase === "ANALYZED" ? p.c : "var(--text-dim)",
                  fontFamily: "var(--f-heading)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
                  textTransform: "uppercase", cursor: phase === "ANALYZED" ? "pointer" : "not-allowed",
                  opacity: phase === "ANALYZED" ? 1 : 0.4, outline: "none", minHeight: 36,
                }}>
                {pumpState[p.cmd] === "pending" ? "Awaiting ESP32 ACK…" : pumpState[p.cmd] === "sent" ? "✓ SENT" : p.lbl}
              </button>
              {confirmPump === p.cmd && (
                <div style={{ marginTop: 4, background: "rgba(255,176,32,0.05)", border: "1px solid rgba(255,176,32,0.18)", borderRadius: "var(--r-md)", padding: "8px 10px" }}>
                  <div style={{ fontSize: 9, fontFamily: "var(--f-mono)", color: p.c }}>
                    Confirm routing to {p.cmd === "START_PUMP_A" ? "Tank A (reuse)" : "Tank B (discard)"}?
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <button className="btn btn-ghost" style={{ fontSize: 8, padding: "3px 8px", minHeight: "unset" }}
                      onClick={() => { sendPump(p.cmd); setConfirmPump(null); }}>CONFIRM</button>
                    <button className="btn btn-ghost" style={{ fontSize: 8, padding: "3px 8px", minHeight: "unset" }}
                      onClick={() => setConfirmPump(null)}>CANCEL</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bracket reference */}
      <div className="s-block">
        <div className="s-label">FILTRATION BRACKET REFERENCE</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["BRACKET","TURBIDITY","TDS","METHOD","OUTCOME"].map(h => (
              <th key={h} style={{ fontFamily: "var(--f-mono)", fontSize: 8, letterSpacing: "0.1em", color: "var(--text-dim)", textAlign: "left", padding: "5px 8px", borderBottom: "1px solid var(--border)" }}>{h}</th>
            ))}</tr></thead>
            <tbody>
              {brackets.map(b => (
                <tr key={b.id} style={prediction?.bracket === b.id ? { background: `${b.c}08`, boxShadow: `inset 0 0 0 1px ${b.c}44` } : {}}>
                  <td style={{ padding: "7px 8px", borderBottom: "1px solid rgba(0,212,255,0.05)", verticalAlign: "middle" }}>
                    <span className="badge" style={{ color: b.c, borderColor: b.c, background: "transparent" }}>{b.id}</span>
                  </td>
                  <td style={{ fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--text-secondary)", padding: "7px 8px", borderBottom: "1px solid rgba(0,212,255,0.05)" }}>{b.turb}</td>
                  <td style={{ fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--text-secondary)", padding: "7px 8px", borderBottom: "1px solid rgba(0,212,255,0.05)" }}>{b.tds}</td>
                  <td style={{ fontSize: 9, fontFamily: "var(--f-heading)", color: "var(--text-primary)", padding: "7px 8px", borderBottom: "1px solid rgba(0,212,255,0.05)" }}>{b.desc}</td>
                  <td style={{ fontSize: 9, fontFamily: "var(--f-heading)", color: b.c, padding: "7px 8px", borderBottom: "1px solid rgba(0,212,255,0.05)" }}>{b.out}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drain guide */}
      <div className="s-block">
        <div className="s-label">DRAIN SEQUENCE GUIDE</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { ico: "↓", lbl: "Remove plug",      desc: "Sludge drains by gravity from side cut at tank base" },
            { ico: "●", lbl: "Reinsert plug",     desc: "Once sludge fully cleared, seal the side cut" },
            { ico: "↑", lbl: "Open upper outlet", desc: "Clean water drains from above the sludge layer" },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 14, color: "var(--cyan)", minWidth: 20, fontFamily: "var(--f-mono)" }}>{s.ico}</span>
              <div>
                <span style={{ fontFamily: "var(--f-heading)", fontWeight: 700, fontSize: 11, color: "var(--text-primary)" }}>{s.lbl}</span>
                <div style={{ fontSize: 9, fontFamily: "var(--f-heading)", color: "var(--text-secondary)", marginTop: 2 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9, fontFamily: "var(--f-mono)", color: "var(--text-dim)", marginTop: 10 }}>
          Turbidity sensor signals drain-ready. Watch for ANALYZED phase with high WQI before draining.
        </div>
      </div>
    </div>
  );
}

function SectionAlerts({ alerts, setAlerts, alertHistory }: {
  alerts: AlertConfig; setAlerts: (a: AlertConfig) => void; alertHistory: AlertEntry[];
}) {
  async function toggleBrowser(enable: boolean) {
    if (!enable) { setAlerts({ ...alerts, browser: false }); return; }
    const p = await Notification.requestPermission();
    setAlerts({ ...alerts, browser: p === "granted" });
  }

  return (
    <div>
      {/* Thresholds */}
      <div className="s-block">
        <div className="s-label">ALERT THRESHOLDS</div>
        {([
          { lbl: "WQI drops below",        key: "wqiBelow" as const,       unit: "/100", min: 0, max: 100, step: 1,    desc: "maps to wqi.score" },
          { lbl: "Confidence drops below",  key: "confidenceBelow" as const, unit: "/1.0", min: 0, max: 1,   step: 0.05, desc: "maps to confidence.score" },
          { lbl: "Anomaly score exceeds",   key: "anomalyAbove" as const,    unit: "/1.0", min: 0, max: 1,   step: 0.05, desc: "maps to cycleFingerprint.anomalyScore" },
        ]).map(t => (
          <div key={t.key} style={{ padding: "10px 0", borderBottom: "1px solid rgba(0,212,255,0.07)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontFamily: "var(--f-heading)", fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{t.lbl}</span>
                <span style={{ fontSize: 9, color: "var(--text-dim)", marginLeft: 8, fontFamily: "var(--f-mono)" }}>{t.desc}</span>
              </div>
              <span className="t-mono" style={{ fontSize: 12, color: "var(--cyan)" }}>{alerts[t.key]}{t.unit}</span>
            </div>
            <input type="range" min={t.min} max={t.max} step={t.step} value={alerts[t.key]}
              onChange={e => setAlerts({ ...alerts, [t.key]: parseFloat(e.target.value) })}
              style={{
                width: "100%", height: 4, borderRadius: 2, outline: "none", border: "none",
                cursor: "pointer", appearance: "none", marginTop: 8,
                background: `linear-gradient(to right, var(--cyan) ${((alerts[t.key] - t.min) / (t.max - t.min)) * 100}%, rgba(0,212,255,0.15) ${((alerts[t.key] - t.min) / (t.max - t.min)) * 100}%)`,
              } as React.CSSProperties}
            />
          </div>
        ))}
        <div style={{ padding: "10px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontFamily: "var(--f-heading)", fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Sensor flatline detected</span>
            <div style={{ fontSize: 9, color: "var(--text-dim)", fontFamily: "var(--f-mono)", marginTop: 2 }}>always notify — cannot be disabled</div>
          </div>
          <div style={{ width: 40, height: 22, borderRadius: 11, background: "rgba(0,212,255,0.18)", border: "1px solid rgba(0,212,255,0.40)", position: "relative", cursor: "not-allowed" }}>
            <div style={{ position: "absolute", top: 3, left: 21, width: 14, height: 14, borderRadius: "50%", background: "var(--cyan)", boxShadow: "0 0 8px rgba(0,212,255,0.5)" }} />
          </div>
        </div>
      </div>

      {/* Notification method */}
      <div className="s-block">
        <div className="s-label">NOTIFICATION METHOD</div>
        {([
          { key: "inApp" as const,     lbl: "In-App Toast",          sub: "Shows toast in dashboard",        action: (v: boolean) => setAlerts({ ...alerts, inApp: v }) },
          { key: "browser" as const,   lbl: "Browser Notification",  sub: "Native OS push — requires permission", action: toggleBrowser },
          { key: "vibration" as const, lbl: "Vibration",             sub: "Mobile devices only",              action: (v: boolean) => setAlerts({ ...alerts, vibration: v }) },
        ]).map(t => (
          <div key={t.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <span style={{ fontFamily: "var(--f-heading)", fontWeight: 600, fontSize: 12, color: "var(--text-primary)" }}>{t.lbl}</span>
              <div style={{ fontSize: 9, fontFamily: "var(--f-mono)", color: "var(--text-dim)", marginTop: 2 }}>{t.sub}</div>
            </div>
            <button onClick={() => t.action(!alerts[t.key])}
              style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, outline: "none" }}>
              <div style={{ width: 40, height: 22, borderRadius: 11, background: alerts[t.key] ? "rgba(0,212,255,0.18)" : "rgba(255,255,255,0.06)", border: `1px solid ${alerts[t.key] ? "rgba(0,212,255,0.40)" : "var(--border)"}`, position: "relative", transition: "all 0.22s ease" }}>
                <div style={{ position: "absolute", top: 3, left: alerts[t.key] ? 21 : 3, width: 14, height: 14, borderRadius: "50%", background: alerts[t.key] ? "var(--cyan)" : "var(--text-secondary)", boxShadow: alerts[t.key] ? "0 0 8px rgba(0,212,255,0.5)" : "none", transition: "all 0.22s cubic-bezier(0.34,1.56,0.64,1)" }} />
              </div>
            </button>
          </div>
        ))}
      </div>

      {/* Alert history */}
      <div className="s-block">
        <div className="s-label">ALERT HISTORY <span style={{ color: "var(--text-dim)", fontWeight: 400, fontSize: 9 }}>this session</span></div>
        {alertHistory.length === 0
          ? <div style={{ color: "var(--text-dim)", fontSize: 11, fontFamily: "var(--f-mono)", padding: "8px 0" }}>No alerts triggered this session.</div>
          : <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {alertHistory.slice(-10).reverse().map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <span className="t-mono" style={{ fontSize: 9, color: "var(--text-dim)", minWidth: 70 }}>
                    {new Date(a.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  <span className="badge badge-amber" style={{ fontSize: 8 }}>{a.type}</span>
                  <span className="t-mono" style={{ fontSize: 9, color: "var(--text-secondary)" }}>{a.value}</span>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}

function SectionAccount({ showToast }: { showToast: (msg: string) => void }) {
  const user = useWIQUser();
  const role = getRole(user.email ?? "", user.name);
  const initials = user.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div>
      {/* Identity */}
      <div className="s-block">
        <div className="s-label">USER IDENTITY</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {user.photo
            ? <img src={user.photo} style={{ width: 48, height: 48, borderRadius: 12, border: "1px solid var(--border-mid)" }} alt={user.name} />
            : <div style={{ width: 48, height: 48, borderRadius: 12, border: "1px solid var(--border-mid)", background: "linear-gradient(135deg,rgba(0,212,255,0.22),rgba(0,212,255,0.07))", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--f-mono)", fontWeight: 700, fontSize: 15, color: "var(--cyan)", flexShrink: 0 }}>{initials}</div>
          }
          <div>
            <div style={{ fontFamily: "var(--f-heading)", fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>{user.name}</div>
            <div style={{ fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{user.email}</div>
            <div style={{ marginTop: 5 }}>
              <span className={`badge ${role === "ADMIN" ? "badge-cyan" : "badge-dim"}`}>{role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Auth */}
      <div className="s-block" style={{ borderColor: "rgba(255,176,32,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div className="s-label" style={{ marginBottom: 0 }}>AUTHENTICATION</div>
          <span className="badge badge-amber">PENDING INTEGRATION</span>
        </div>
        <div style={{ fontSize: 11, fontFamily: "var(--f-heading)", color: "var(--text-secondary)", marginBottom: 10 }}>
          Current method: <span className="t-mono" style={{ color: "var(--text-primary)", fontSize: 10 }}>Simulated via localStorage</span>
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => showToast("OAuth integration coming in next build.")}>
          🔗 Connect Google Account
        </button>
      </div>

      {/* Persistence notice */}
      <div className="s-block" style={{ background: "rgba(0,50,120,0.06)" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 1, flexShrink: 0 }}>ℹ</span>
          <div>
            <div style={{ fontFamily: "var(--f-heading)", fontWeight: 600, fontSize: 11, color: "var(--text-primary)", marginBottom: 4 }}>SESSION PERSISTENCE</div>
            <div style={{ fontSize: 10, fontFamily: "var(--f-heading)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              The backend is stateless. All readings, fingerprints, and predictions are lost on server restart. This is by design for the current build. Production version will persist to a database.
            </div>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div style={{ borderTop: "1px solid rgba(255,69,96,0.15)", paddingTop: 16, margin: "0 16px 16px" }}>
        <div style={{ fontFamily: "var(--f-heading)", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "var(--red)", marginBottom: 8, textTransform: "uppercase" }}>DANGER ZONE</div>
        <div style={{ fontSize: 10, fontFamily: "var(--f-heading)", color: "var(--text-secondary)", marginBottom: 10 }}>
          Clears all <span className="t-mono" style={{ fontSize: 9, color: "var(--text-primary)" }}>wiq_*</span> localStorage keys and reloads.
        </div>
        <HoldButton label="CLEAR ALL LOCAL SETTINGS" color="red" onConfirm={() => {
          Object.keys(localStorage).filter(k => k.startsWith("wiq_")).forEach(k => localStorage.removeItem(k));
          window.location.reload();
        }} />
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mobile;
}

export default function Settings() {
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState<Section>("system");
  const [status, setStatus]       = useState<SysStatus | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [fingerprints, setFingerprints] = useState<Fingerprint[]>([]);
  const [readings, setReadings]   = useState<{ ph: number; turbidity: number; tds: number }[]>([]);
  const [syncing, setSyncing]     = useState(false);
  const [lastSync, setLastSync]   = useState<Date | null>(null);
  const [railFlash, setRailFlash] = useState(false);
  const [batchSize, setBatchSize] = useState(() => parseInt(localStorage.getItem("wiq_batch_size") ?? "5") || 5);
  const [stage, setStage]         = useState<Stage>(() => (localStorage.getItem("wiq_stage") as Stage) ?? "post_lamella");
  const [thresholds, setThresholds] = useState<Thresholds>(() => {
    try { const r = localStorage.getItem("wiq_thresholds"); return r ? JSON.parse(r) : THRESHOLDS_DEFAULT; } catch { return THRESHOLDS_DEFAULT; }
  });
  const [alertConfig, setAlertConfig] = useState<AlertConfig>(() => {
    try { const r = localStorage.getItem("wiq_alerts"); return r ? JSON.parse(r) : ALERTS_DEFAULT; } catch { return ALERTS_DEFAULT; }
  });
  const [alertHistory, setAlertHistory] = useState<AlertEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const backendUrl = localStorage.getItem("wiq_backend_url") ?? DEFAULT_URL;

  const showToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(null), 3500);
  }, []);

  const doSync = useCallback(async () => {
    setSyncing(true);
    try {
      const t0 = Date.now();
      const [s, p, f, r] = await Promise.allSettled([
        fetch(`${backendUrl}/session/status`).then(x => x.json()),
        fetch(`${backendUrl}/prediction/latest`).then(x => x.json()),
        fetch(`${backendUrl}/fingerprints`).then(x => x.json()),
        fetch(`${backendUrl}/session/readings`).then(x => x.json()),
      ]);
      const ms = Date.now() - t0;
      if (s.status === "fulfilled") setStatus({ ...s.value, latencyMs: ms, online: true });
      if (p.status === "fulfilled") setPrediction(p.value);
      if (f.status === "fulfilled") setFingerprints(Array.isArray(f.value) ? f.value : (f.value?.fingerprints ?? []));
      if (r.status === "fulfilled") setReadings(Array.isArray(r.value) ? r.value : (r.value?.readings ?? []));
      setLastSync(new Date()); setRailFlash(true); setTimeout(() => setRailFlash(false), 600);
    } catch { setStatus(s => s ? { ...s, online: false } : null); }
    setSyncing(false);
  }, [backendUrl]);

  useEffect(() => { doSync(); const id = setInterval(doSync, 10000); return () => clearInterval(id); }, [doSync]);
  useEffect(() => { localStorage.setItem("wiq_thresholds", JSON.stringify(thresholds)); }, [thresholds]);
  useEffect(() => { localStorage.setItem("wiq_batch_size", String(batchSize)); }, [batchSize]);
  useEffect(() => { localStorage.setItem("wiq_alerts", JSON.stringify(alertConfig)); }, [alertConfig]);

  // Alert checking
  useEffect(() => {
    if (!prediction) return;
    const now = Date.now(), toAdd: AlertEntry[] = [];
    if (prediction.wqi?.score != null && prediction.wqi.score < alertConfig.wqiBelow)
      toAdd.push({ ts: now, type: "LOW WQI", value: `score ${prediction.wqi.score.toFixed(1)} < ${alertConfig.wqiBelow}` });
    if (prediction.confidence?.score != null && prediction.confidence.score < alertConfig.confidenceBelow)
      toAdd.push({ ts: now, type: "LOW CONFIDENCE", value: `${prediction.confidence.score.toFixed(2)} < ${alertConfig.confidenceBelow}` });
    if (prediction.cycleFingerprint?.anomalyScore != null && prediction.cycleFingerprint.anomalyScore > alertConfig.anomalyAbove)
      toAdd.push({ ts: now, type: "HIGH ANOMALY", value: `score ${prediction.cycleFingerprint.anomalyScore.toFixed(2)} > ${alertConfig.anomalyAbove}` });
    if (prediction.flatline?.anyFlatlined)
      toAdd.push({ ts: now, type: "SENSOR FLATLINE", value: "sensor dead detected" });
    if (toAdd.length > 0) setAlertHistory(h => [...h, ...toAdd].slice(-50));
  }, [prediction, alertConfig]);

  const sectionContent: Record<Section, React.ReactNode> = {
    system:       <SectionSystem status={status} batchSize={batchSize} setBatchSize={setBatchSize} onStatusUpdate={doSync} backendUrl={backendUrl} />,
    intelligence: <SectionIntelligence prediction={prediction} fingerprints={fingerprints} thresholds={thresholds} setThresholds={setThresholds} />,
    sensors:      <SectionSensors prediction={prediction} readings={readings} stage={stage} setStage={setStage} thresholds={thresholds} />,
    tank:         <SectionTank status={status} prediction={prediction} backendUrl={backendUrl} />,
    alerts:       <SectionAlerts alerts={alertConfig} setAlerts={setAlertConfig} alertHistory={alertHistory} />,
    account:      <SectionAccount showToast={showToast} />,
  };

  return (
    <>
      <style>{CSS}</style>
      {toast && <div className="wiq-toast">{toast}</div>}
      <div className="page" style={{ paddingTop: 12 }}>
        <div className="settings-layout">

          {/* Left nav */}
          <nav className="settings-leftnav">
            <div style={{ fontFamily: "var(--f-mono)", fontSize: 8, letterSpacing: "0.14em", color: "var(--text-dim)", padding: "8px 14px 4px" }}>CONFIGURATION</div>
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px",
                  border: "none", background: activeSection === s.id ? "rgba(0,212,255,0.07)" : "transparent",
                  cursor: "pointer", position: "relative", textAlign: "left", outline: "none",
                  transition: "background 0.18s ease",
                }}>
                <span style={{ fontSize: 13, color: activeSection === s.id ? "var(--cyan)" : "var(--text-secondary)", width: 16, textAlign: "center", flexShrink: 0 }}>{s.icon}</span>
                <span style={{ fontFamily: "var(--f-heading)", fontSize: 12, fontWeight: 600, color: activeSection === s.id ? "var(--text-primary)" : "var(--text-secondary)" }}>{s.label}</span>
                {activeSection === s.id && (
                  <span style={{ position: "absolute", right: 0, top: "20%", bottom: "20%", width: 2, background: "var(--cyan)", borderRadius: 1, boxShadow: "0 0 8px rgba(0,212,255,0.6)" }} />
                )}
              </button>
            ))}
          </nav>

          {/* Center */}
          <div className="settings-center">
            {/* Mobile pill tabs */}
            <div className="settings-mobiletabs">
              {SECTIONS.map(s => (
                <button key={s.id} onClick={() => setActiveSection(s.id)}
                  style={{
                    flexShrink: 0, padding: "6px 12px", borderRadius: 20,
                    border: `1px solid ${activeSection === s.id ? "var(--border-mid)" : "var(--border)"}`,
                    background: activeSection === s.id ? "rgba(0,212,255,0.08)" : "var(--bg-glass)",
                    fontFamily: "var(--f-heading)", fontSize: 11, fontWeight: 600,
                    color: activeSection === s.id ? "var(--cyan)" : "var(--text-secondary)",
                    cursor: "pointer", whiteSpace: "nowrap", outline: "none",
                    backdropFilter: "blur(12px)",
                  }}>{s.icon} {s.label}</button>
              ))}
            </div>

            <div className="g-card">
              <div className="g-card-header">
                <span className="g-card-accent-bar" style={{ background: "var(--cyan)" }} />
                <span className="g-card-header-label">
                  {SECTIONS.find(s => s.id === activeSection)?.icon}&nbsp;{SECTIONS.find(s => s.id === activeSection)?.label.toUpperCase()}
                </span>
                <span style={{ marginLeft: "auto", fontSize: 9, fontFamily: "var(--f-mono)", color: "var(--text-dim)" }}>
                  settings / {activeSection}
                </span>
              </div>
              {sectionContent[activeSection]}
            </div>
          </div>

          {/* Right rail */}
          <LivePulse status={status} prediction={prediction} batchSize={batchSize}
            syncing={syncing} onSync={doSync} lastSync={lastSync} railFlash={railFlash} />
        </div>
      </div>
    </>
  );
}

// ─── Scoped CSS ───────────────────────────────────────────────────────────────
const CSS = `
.settings-layout {
  display: grid;
  grid-template-columns: 168px 1fr 196px;
  gap: 12px;
  align-items: start;
}
@media (max-width: 1100px) {
  .settings-layout { grid-template-columns: 1fr 196px; }
  .settings-leftnav { display: none !important; }
}
@media (max-width: 768px) {
  .settings-layout { grid-template-columns: 1fr !important; }
  .settings-leftnav { display: none !important; }
  .settings-rightpanel { display: none !important; }
  .settings-mobiletabs { display: flex !important; flex-wrap: nowrap; overflow-x: auto; }
  .settings-center { min-width: 0; width: 100%; overflow-x: hidden; }
  .g-card { border-radius: 10px; }
  /* Ensure all content fits within mobile viewport */
  .s-block { padding: 12px !important; }
  .s-block input, .s-block select, .s-block textarea { max-width: 100% !important; box-sizing: border-box !important; }
  /* Stack any flex rows that overflow */
  .s-row-wrap { flex-wrap: wrap !important; }
  /* Prevent any element from overflowing */
  .settings-center * { max-width: 100%; }
  /* Fix page padding for mobile */
  .page { padding-left: 8px !important; padding-right: 8px !important; }
  /* Tank SVG should not overflow */
  svg { max-width: 100% !important; height: auto !important; }
}

.settings-leftnav {
  position: sticky; top: 68px;
  background: var(--bg-glass); border: 1px solid var(--border);
  border-radius: var(--r-xl); overflow: hidden;
  backdrop-filter: blur(var(--glass-blur));
  box-shadow: var(--glass-shadow); padding: 6px 0;
}

.settings-mobiletabs {
  display: none; flex-wrap: nowrap; overflow-x: auto; gap: 6px; padding-bottom: 10px;
  scrollbar-width: none;
}
.settings-mobiletabs::-webkit-scrollbar { display: none; }
@media (max-width: 1100px) { .settings-mobiletabs { display: flex !important; } }

.settings-center { display: flex; flex-direction: column; gap: 10px; min-width: 0; overflow-x: hidden; }

/* Section blocks */
.s-block {
  padding: 16px;
  border-bottom: 1px solid var(--border);
}
.s-block:last-child { border-bottom: none; }
.s-label {
  font-family: var(--f-heading); font-size: 10px; font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-secondary);
  margin-bottom: 10px; display: block;
}

/* Slider thumb */
input[type=range]::-webkit-slider-thumb {
  appearance: none; width: 14px; height: 14px;
  border-radius: 50%; background: var(--cyan);
  border: 2px solid var(--bg-deep);
  box-shadow: 0 0 8px rgba(0,212,255,0.5);
  cursor: pointer;
}
input[type=range]::-moz-range-thumb {
  width: 14px; height: 14px; border-radius: 50%; background: var(--cyan);
  border: 2px solid var(--bg-deep); box-shadow: 0 0 8px rgba(0,212,255,0.5); cursor: pointer;
}

/* Toast */
.wiq-toast {
  position: fixed; bottom: calc(var(--nav-h) + 16px); left: 50%; transform: translateX(-50%);
  background: rgba(5,18,38,0.97); border: 1px solid var(--border-mid); border-radius: 20px;
  padding: 8px 18px; font-family: var(--f-mono); font-size: 11px; color: var(--text-primary);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,212,255,0.08);
  z-index: 9999; animation: fadeUp 0.3s ease; backdrop-filter: blur(20px); white-space: nowrap;
}
`;
