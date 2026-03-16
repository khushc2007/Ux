import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

/* ═══════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════ */
const BACKEND = "https://backend-update-1.onrender.com";
const TICK_MS  = 4000;
const MAX_PTS  = 50;

/* ═══════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════ */
type SensorPt   = { t: string; ph: number; turb: number; tds: number };
type PumpId     = "A" | "B" | "C";
type PumpState  = "ON" | "OFF" | "AUTO";

interface WQI         { score: number; interpretation: string; phContribution: number; turbidityContribution: number; tdsContribution: number }
interface Confidence  { score: number; level: string; recommendation: string; disagreementFlags: string[] }
interface Flatline    { anyFlatlined: boolean; failsafeTriggered: boolean; ph: boolean; turbidity: boolean; tds: boolean }
interface Recal       { triggered: boolean; correctedTurbidity: number | null; originalTurbidity: number | null; reason: string | null }
interface Fingerprint { anomalyScore: number; anomalyFlags: string[]; turbiditySlope: number; phSlope: number; tdsSlope: number; durationMs: number }
interface Prediction  {
  bracket: string; reusable: boolean; suggestedTank: string; filtrationMethod: string;
  wqi?: WQI; confidence?: Confidence; flatline?: Flatline; recalibration?: Recal;
  cycleFingerprint?: Fingerprint; stageAware?: { stage: string; note: string }
}

/* ═══════════════════════════════════════════════
   DRIFT SIM
═══════════════════════════════════════════════ */
function drift(v: number, min: number, max: number, step: number) {
  return Math.max(min, Math.min(max, +(v + (Math.random() > 0.5 ? step : -step) + (Math.random() - 0.5) * step * 0.4).toFixed(2)));
}

/* ═══════════════════════════════════════════════
   SHARED CARD COMPONENT
═══════════════════════════════════════════════ */
function Card({ title, accent = "var(--cyan)", live, children, className = "", style }: {
  title?: string; accent?: string; live?: boolean; children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <div className={`g-card ${className}`} style={{ display: "flex", flexDirection: "column", ...style }}>
      {title && (
        <div className="g-card-header">
          <span className="g-card-accent-bar" style={{ background: accent }} />
          <span className="g-card-header-label">{title}</span>
          {live && (
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--f-mono)", fontSize: 8, fontWeight: 700, color: "var(--emerald)", letterSpacing: "0.08em" }}>
              <span className="dot dot-live" style={{ width: 5, height: 5 }} />LIVE
            </span>
          )}
        </div>
      )}
      <div className="g-card-body" style={{ padding: title ? undefined : 0 }}>{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   HERO VERDICT CARD
═══════════════════════════════════════════════ */
function HeroVerdict({ pred }: { pred: Prediction | null }) {
  const reusable  = pred?.reusable ?? null;
  const bracket   = pred?.bracket ?? "—";
  const wqi       = pred?.wqi?.score ?? 0;
  const interp    = pred?.wqi?.interpretation ?? "awaiting";

  const bracketColors: Record<string, string> = {
    F1: "var(--emerald)", F2: "var(--cyan)", F3: "var(--amber)", F4: "#f97316", F5: "var(--red)"
  };
  const bc = bracketColors[bracket] ?? "var(--text-secondary)";
  const verdictColor = reusable === true ? "var(--emerald)" : reusable === false ? "var(--red)" : "var(--text-secondary)";
  const verdictText  = reusable === true ? "SAFE TO REUSE" : reusable === false ? "DISCARD" : "ANALYZING…";

  return (
    <div className="g-card-solid" style={{ padding: "20px 22px", position: "relative" }}>
      {/* Scan line */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg,transparent,var(--cyan),var(--emerald),transparent)", opacity: 0.6, animation: "shimmerSlide 4s linear infinite", backgroundSize: "200% 100%" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        {/* Verdict */}
        <div>
          <div style={{ fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--text-secondary)", letterSpacing: "0.14em", marginBottom: 6, textTransform: "uppercase" }}>
            System Verdict
          </div>
          <div style={{ fontFamily: "var(--f-display)", fontSize: 26, fontWeight: 900, color: verdictColor, letterSpacing: "0.08em", lineHeight: 1, textShadow: reusable !== null ? `0 0 24px ${verdictColor}55` : "none", transition: "all 0.5s ease" }}>
            {verdictText}
          </div>
          {pred?.filtrationMethod && (
            <div style={{ fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--text-secondary)", marginTop: 5, letterSpacing: "0.04em" }}>
              {pred.filtrationMethod}
            </div>
          )}
        </div>

        {/* Bracket + Tank */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.12em", marginBottom: 4 }}>BRACKET</div>
            <div style={{ fontFamily: "var(--f-display)", fontSize: 32, fontWeight: 900, color: bc, lineHeight: 1, filter: `drop-shadow(0 0 12px ${bc}55)`, transition: "all 0.5s ease" }}>
              {bracket}
            </div>
          </div>
          <div style={{ width: 1, height: 40, background: "var(--border)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.12em", marginBottom: 4 }}>TANK</div>
            <div style={{ fontFamily: "var(--f-display)", fontSize: 32, fontWeight: 900, color: "var(--cyan)", lineHeight: 1 }}>
              {pred?.suggestedTank ?? "—"}
            </div>
          </div>
          <div style={{ width: 1, height: 40, background: "var(--border)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--text-dim)", letterSpacing: "0.12em", marginBottom: 4 }}>WQI</div>
            <div style={{ fontFamily: "var(--f-display)", fontSize: 28, fontWeight: 900, color: bc, lineHeight: 1 }}>
              {wqi.toFixed(0)}
            </div>
            <div style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--text-secondary)", marginTop: 2, textTransform: "uppercase" }}>{interp}</div>
          </div>
        </div>

        {/* Stage note */}
        {pred?.stageAware?.note && (
          <div style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--r-md)", background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.10)", fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--text-secondary)", lineHeight: 1.6, letterSpacing: "0.03em" }}>
            <span style={{ color: "var(--cyan)", marginRight: 6 }}>◈ STAGE:</span>{pred.stageAware.stage.replace(/_/g, " ")} — {pred.stageAware.note}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SENSOR KPI STRIP
═══════════════════════════════════════════════ */
function SensorStrip({ pts }: { pts: SensorPt[] }) {
  const last = pts[pts.length - 1] ?? { ph: 7.2, turb: 2.8, tds: 320 };
  const kpis = [
    { l: "pH",       v: last.ph.toFixed(2),   unit: "",    color: "var(--cyan)",    ok: last.ph >= 6.5 && last.ph <= 8.5,   desc: "Acidity" },
    { l: "Turbidity",v: last.turb.toFixed(1), unit: "NTU", color: "var(--amber)",   ok: last.turb < 10,                     desc: "Clarity" },
    { l: "TDS",      v: last.tds.toFixed(0),  unit: "ppm", color: "var(--emerald)", ok: last.tds < 600,                     desc: "Dissolved Solids" },
    { l: "Data pts", v: (pts.length * 47).toLocaleString(), unit: "", color: "var(--text-primary)", ok: true,               desc: "Buffer" },
  ];
  return (
    <div className="kpi-strip" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, borderRadius: "var(--r-lg)", overflow: "hidden", border: "1px solid var(--border)", background: "var(--border)" }}>
      {kpis.map((k, i) => (
        <div key={k.l} style={{ padding: "12px 14px", background: "var(--bg-glass)", backdropFilter: "blur(18px)", position: "relative", transition: "background 0.2s" }}>
          {/* Top accent */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: k.ok ? k.color : "var(--red)", opacity: 0.5 }} />
          <div style={{ fontFamily: "var(--f-heading)", fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 5 }}>{k.l}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 2 }}>
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 20, fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.v}</span>
            {k.unit && <span style={{ fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--text-secondary)" }}>{k.unit}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span className={`dot ${k.ok ? "dot-live" : "dot-warn"}`} style={{ width: 5, height: 5 }} />
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: k.ok ? "var(--emerald)" : "var(--amber)" }}>{k.ok ? "OK" : "WARN"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   LIVE CHART
═══════════════════════════════════════════════ */
function LiveChart({ pts }: { pts: SensorPt[] }) {
  if (pts.length < 2) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontFamily: "var(--f-mono)", fontSize: 11 }}>Awaiting data…</div>
  );
  const W = 600, H = 190, pad = { t: 10, r: 10, b: 28, l: 38 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const series = [
    { key: "ph"   as keyof SensorPt, color: "#00D4FF", label: "pH",   min: 4,  max: 10 },
    { key: "turb" as keyof SensorPt, color: "#FFB020", label: "TURB", min: 0,  max: 20 },
    { key: "tds"  as keyof SensorPt, color: "#00FFB2", label: "TDS",  min: 0,  max: 1200 },
  ];
  const toX = (i: number) => pad.l + (i / (pts.length - 1)) * iW;
  const toY = (v: number, mn: number, mx: number) => pad.t + iH - ((v - mn) / (mx - mn)) * iH;
  const last = pts[pts.length - 1];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "10px 12px 0" }}>
      {/* Legend */}
      <div style={{ display: "flex", gap: 14, marginBottom: 8, flexWrap: "wrap" }}>
        {series.map(s => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, boxShadow: `0 0 5px ${s.color}` }} />
            <span style={{ fontFamily: "var(--f-heading)", fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", color: "var(--text-secondary)", textTransform: "uppercase" }}>{s.label}</span>
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 10, fontWeight: 700, color: s.color }}>
              {(last[s.key] as number)?.toFixed(s.key === "tds" ? 0 : 2)}
            </span>
          </div>
        ))}
      </div>
      {/* SVG */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: "block" }}>
          <defs>
            {series.map(s => (
              <linearGradient key={s.key} id={`lg-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.20" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.00" />
              </linearGradient>
            ))}
          </defs>
          {[0,.25,.5,.75,1].map(f => (
            <line key={f} x1={pad.l} y1={pad.t+f*iH} x2={pad.l+iW} y2={pad.t+f*iH} stroke="rgba(0,212,255,0.05)" strokeWidth="1" />
          ))}
          {[0, Math.floor(pts.length/2), pts.length-1].map(i => i < pts.length && (
            <text key={i} x={toX(i)} y={H-pad.b+12} textAnchor="middle" fill="var(--text-dim)" fontSize="7" fontFamily="var(--f-mono)">{pts[i].t}</text>
          ))}
          {series.map(s => {
            const p = pts.map((pt, i) => ({ x: toX(i), y: toY(pt[s.key] as number, s.min, s.max) }));
            const line = p.map((pt, i) => `${i===0?"M":"L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");
            const fill = `${line} L${p[p.length-1].x.toFixed(1)},${pad.t+iH} L${p[0].x.toFixed(1)},${pad.t+iH} Z`;
            return (
              <g key={s.key}>
                <path d={fill} fill={`url(#lg-${s.key})`} />
                <path d={line} fill="none" stroke={s.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={p[p.length-1].x} cy={p[p.length-1].y} r="3" fill={s.color} style={{ filter: `drop-shadow(0 0 4px ${s.color})` }} />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   WQI GAUGE
═══════════════════════════════════════════════ */
function WQIGauge({ wqi }: { wqi: WQI | null }) {
  const s = wqi?.score ?? 0;
  const c = s >= 80 ? "#00FFB2" : s >= 65 ? "#00D4FF" : s >= 50 ? "#FFB020" : s >= 30 ? "#f97316" : "#FF4560";
  const R = 36, circ = 2*Math.PI*R, dash = (s/100)*circ;
  return (
    <div style={{ padding: "14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <svg width="92" height="92" viewBox="0 0 92 92">
        <circle cx="46" cy="46" r={R} fill="none" stroke="rgba(0,212,255,0.07)" strokeWidth="7" />
        <circle cx="46" cy="46" r={R} fill="none" stroke={c} strokeWidth="7"
          strokeDasharray={`${dash.toFixed(1)} ${(circ-dash).toFixed(1)}`}
          strokeDashoffset={circ*0.25} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease, stroke 0.5s ease", filter: `drop-shadow(0 0 5px ${c})` }} />
        <text x="46" y="42" textAnchor="middle" fill={c} fontSize="18" fontWeight="700" fontFamily="var(--f-mono)">{s.toFixed(0)}</text>
        <text x="46" y="54" textAnchor="middle" fill="var(--text-secondary)" fontSize="7" fontFamily="var(--f-mono)">/100 WQI</text>
      </svg>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "var(--f-heading)", fontSize: 11, fontWeight: 700, color: c, letterSpacing: "0.08em", textTransform: "uppercase" }}>{wqi?.interpretation ?? "—"}</div>
      </div>
      {wqi && (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 5 }}>
          {[{ l: "pH", v: wqi.phContribution }, { l: "Turbidity", v: wqi.turbidityContribution }, { l: "TDS", v: wqi.tdsContribution }].map(r => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--text-secondary)", minWidth: 46 }}>{r.l}</span>
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(0,212,255,0.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100,(r.v/50)*100)}%`, background: c, borderRadius: 2, transition: "width .8s ease" }} />
              </div>
              <span style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: c, minWidth: 24, textAlign: "right" }}>{r.v.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   CONFIDENCE
═══════════════════════════════════════════════ */
function ConfidencePanel({ conf }: { conf: Confidence | null }) {
  const s = conf?.score ?? 0;
  const pct = (s * 100).toFixed(0);
  const c = s >= 0.85 ? "#00FFB2" : s >= 0.70 ? "#00D4FF" : s >= 0.50 ? "#FFB020" : "#FF4560";
  const rec = conf?.recommendation ?? "—";
  const rc = rec === "proceed" ? "#00FFB2" : rec === "extend_ec_cycle" ? "#00D4FF" : rec === "re_run_cycle" ? "#FFB020" : "#FF4560";
  return (
    <div style={{ padding: "14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ fontFamily: "var(--f-mono)", fontSize: 22, fontWeight: 700, color: c, lineHeight: 1 }}>{pct}%</div>
          <div style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--text-dim)", marginTop: 1 }}>Sensor Agreement</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontFamily: "var(--f-mono)", fontSize: 9, fontWeight: 700, color: rc, textTransform: "uppercase", letterSpacing: "0.04em" }}>{rec.replace(/_/g, " ")}</div>
          <div style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--text-dim)" }}>{conf?.level ?? "—"}</div>
        </div>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "rgba(0,212,255,0.07)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: c, borderRadius: 2, transition: "width 1s ease", boxShadow: `0 0 6px ${c}` }} />
      </div>
      {conf?.disagreementFlags?.length
        ? <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{conf.disagreementFlags.map(f => <span key={f} className="badge badge-amber" style={{ fontSize: 7 }}>{f.replace(/_/g, " ")}</span>)}</div>
        : <div style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--emerald)" }}>✓ All sensors in agreement</div>
      }
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SENSOR HEALTH
═══════════════════════════════════════════════ */
function SensorHealth({ flat }: { flat: Flatline | null }) {
  const sensors = [{ n: "pH", d: flat?.ph ?? false }, { n: "Turbidity", d: flat?.turbidity ?? false }, { n: "TDS", d: flat?.tds ?? false }];
  return (
    <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      {flat?.failsafeTriggered && (
        <div style={{ padding: "7px 10px", borderRadius: "var(--r-sm)", background: "rgba(255,69,96,0.10)", border: "1px solid rgba(255,69,96,0.28)", fontFamily: "var(--f-mono)", fontSize: 9, fontWeight: 700, color: "var(--red)", textAlign: "center", animation: "statusBlink 2s ease-in-out infinite" }}>
          ⚠ SENSOR FAILSAFE — DISCARD ENFORCED
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        {sensors.map(s => (
          <div key={s.n} style={{ flex: 1, padding: "9px 6px", borderRadius: "var(--r-sm)", background: s.d ? "rgba(255,69,96,0.06)" : "rgba(0,255,178,0.04)", border: `1px solid ${s.d ? "rgba(255,69,96,0.20)" : "rgba(0,255,178,0.12)"}`, textAlign: "center" }}>
            <div style={{ marginBottom: 4 }}><span className={`dot ${s.d ? "dot-dead" : "dot-live"}`} /></div>
            <div style={{ fontFamily: "var(--f-heading)", fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", color: s.d ? "var(--red)" : "var(--emerald)", textTransform: "uppercase" }}>{s.n}</div>
            <div style={{ fontFamily: "var(--f-mono)", fontSize: 7, color: s.d ? "var(--red)" : "var(--text-secondary)", marginTop: 1 }}>{s.d ? "DEAD" : "OK"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   AUTO-RECALIBRATION
═══════════════════════════════════════════════ */
function RecalPanel({ recal }: { recal: Recal | null }) {
  const fired = recal?.triggered ?? false;
  return (
    <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: fired ? "var(--amber)" : "rgba(0,212,255,0.18)", boxShadow: fired ? "0 0 8px var(--amber)" : "none", animation: fired ? "pulseDot 1.5s infinite" : "none", flexShrink: 0 }} />
        <span style={{ fontFamily: "var(--f-mono)", fontSize: 10, fontWeight: 700, color: fired ? "var(--amber)" : "var(--text-secondary)", letterSpacing: "0.04em" }}>
          {fired ? "RECAL FIRED" : "SENSORS NOMINAL"}
        </span>
      </div>
      {fired && recal && (
        <div style={{ display: "flex", gap: 8 }}>
          {[{ l: "ORIGINAL", v: recal.originalTurbidity, c: "var(--red)" }, { l: "CORRECTED", v: recal.correctedTurbidity, c: "var(--emerald)" }].map(r => (
            <div key={r.l} style={{ flex: 1, padding: "6px 8px", borderRadius: "var(--r-sm)", background: "var(--bg-inset)", border: "1px solid var(--border)" }}>
              <div style={{ fontFamily: "var(--f-mono)", fontSize: 7, color: "var(--text-dim)", marginBottom: 2 }}>{r.l}</div>
              <div style={{ fontFamily: "var(--f-mono)", fontSize: 13, fontWeight: 700, color: r.c }}>{r.v?.toFixed(2)} NTU</div>
            </div>
          ))}
        </div>
      )}
      {!fired && <div style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--text-secondary)" }}>Cross-sensor validation passing</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   CYCLE FINGERPRINT
═══════════════════════════════════════════════ */
function FingerprintPanel({ fp }: { fp: Fingerprint | null }) {
  const s = fp?.anomalyScore ?? 0;
  const c = s < 0.3 ? "var(--emerald)" : s < 0.6 ? "var(--amber)" : "var(--red)";
  return (
    <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ fontFamily: "var(--f-mono)", fontSize: 20, fontWeight: 700, color: c, lineHeight: 1 }}>{(s*100).toFixed(0)}<span style={{ fontSize: 9 }}>/100</span></div>
          <div style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--text-dim)" }}>Anomaly Score</div>
        </div>
        {fp?.durationMs && <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--text-primary)" }}>{(fp.durationMs/1000).toFixed(1)}s</div>
          <div style={{ fontFamily: "var(--f-mono)", fontSize: 7, color: "var(--text-dim)" }}>cycle</div>
        </div>}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {[{ l: "pH", v: fp?.phSlope ?? 0 }, { l: "TURB", v: fp?.turbiditySlope ?? 0 }, { l: "TDS", v: fp?.tdsSlope ?? 0 }].map(x => (
          <div key={x.l} style={{ flex: 1, padding: "5px", borderRadius: "var(--r-sm)", background: "var(--bg-inset)", border: "1px solid var(--border)", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--f-mono)", fontSize: 9, fontWeight: 700, color: x.v > 0 ? "var(--emerald)" : x.v < 0 ? "var(--red)" : "var(--text-secondary)" }}>{x.v > 0 ? "+" : ""}{x.v.toFixed(3)}</div>
            <div style={{ fontFamily: "var(--f-mono)", fontSize: 7, color: "var(--text-dim)", marginTop: 1 }}>{x.l}</div>
          </div>
        ))}
      </div>
      {fp?.anomalyFlags?.length
        ? <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>{fp.anomalyFlags.map(f => <span key={f} className="badge badge-amber" style={{ fontSize: 7 }}>{f.replace(/_/g, " ").substring(0, 22)}</span>)}</div>
        : fp ? <div style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--emerald)" }}>✓ Cycle shape nominal</div> : null
      }
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SYSTEM STATUS
═══════════════════════════════════════════════ */
function SystemStatus({ pred, backendOk }: { pred: Prediction | null; backendOk: boolean | null }) {
  const rows = [
    { l: "Backend API",   v: backendOk === null ? "CHECKING" : backendOk ? "ONLINE" : "OFFLINE", c: backendOk === null ? "var(--text-secondary)" : backendOk ? "var(--emerald)" : "var(--red)" },
    { l: "Sensor Array",  v: pred?.flatline?.anyFlatlined ? "DEGRADED" : "NOMINAL", c: pred?.flatline?.anyFlatlined ? "var(--amber)" : "var(--emerald)" },
    { l: "Last Bracket",  v: pred?.bracket ?? "—", c: pred?.bracket === "F1" || pred?.bracket === "F2" ? "var(--emerald)" : pred?.bracket ? "var(--amber)" : "var(--text-secondary)" },
    { l: "WQI Score",     v: pred?.wqi ? `${pred.wqi.score.toFixed(0)}/100` : "—", c: "var(--cyan)" },
    { l: "Confidence",    v: pred?.confidence?.level?.toUpperCase() ?? "—", c: "var(--text-primary)" },
    { l: "Routing",       v: pred ? (pred.reusable ? "REUSE →" : "DISCARD →") : "—", c: pred ? (pred.reusable ? "var(--emerald)" : "var(--red)") : "var(--text-secondary)" },
  ];
  return (
    <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
      {rows.map(r => (
        <div key={r.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 9px", borderRadius: "var(--r-sm)", background: "var(--bg-inset)", border: "1px solid var(--border)" }}>
          <span style={{ fontFamily: "var(--f-heading)", fontSize: 9, fontWeight: 600, letterSpacing: "0.10em", color: "var(--text-secondary)", textTransform: "uppercase" }}>{r.l}</span>
          <span style={{ fontFamily: "var(--f-mono)", fontSize: 9, fontWeight: 700, color: r.c }}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   PUMP CONTROL
═══════════════════════════════════════════════ */
function PumpControl() {
  const [pumps, setPumps] = useState<Record<PumpId, PumpState>>({ A: "AUTO", B: "AUTO", C: "OFF" });
  const [busy, setBusy]   = useState(false);
  const [last, setLast]   = useState<string | null>(null);
  const sc: Record<PumpState, string> = { ON: "#00FFB2", OFF: "var(--text-dim)", AUTO: "#00D4FF" };

  const send = useCallback(async (cmd: string) => {
    try { setBusy(true); await fetch(`${BACKEND}/pump/command`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: cmd }) }); setLast(cmd); } catch {} finally { setBusy(false); }
  }, []);
  const set = (id: PumpId, s: PumpState) => { setPumps(p => ({ ...p, [id]: s })); send(s === "ON" ? `START_PUMP_${id}` : s === "OFF" ? `STOP_PUMP_${id}` : `AUTO_PUMP_${id}`); };

  return (
    <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
      {(["A","B","C"] as PumpId[]).map(id => (
        <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: "var(--r-sm)", background: "var(--bg-inset)", border: "1px solid var(--border)" }}>
          <div style={{ minWidth: 50 }}>
            <div style={{ fontFamily: "var(--f-heading)", fontSize: 11, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.04em" }}>Pump {id}</div>
          </div>
          <div style={{ flex: 1, display: "flex", borderRadius: 5, overflow: "hidden", border: "1px solid rgba(0,212,255,0.09)" }}>
            {(["ON","OFF","AUTO"] as PumpState[]).map((s, i) => {
              const active = pumps[id] === s;
              return <button key={s} onClick={() => set(id, s)} disabled={busy} style={{ flex: 1, padding: "5px 0", border: "none", borderLeft: i > 0 ? "1px solid rgba(0,212,255,0.07)" : "none", background: active ? `${sc[s]}18` : "transparent", color: active ? sc[s] : "var(--text-dim)", fontFamily: "var(--f-mono)", fontSize: 9, fontWeight: active ? 700 : 400, cursor: busy ? "not-allowed" : "pointer", boxShadow: active ? `inset 0 -2px 0 ${sc[s]}` : "none", transition: "all .15s", letterSpacing: "0.05em" }}>{s}</button>;
            })}
          </div>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: sc[pumps[id]], boxShadow: `0 0 6px ${sc[pumps[id]]}`, flexShrink: 0 }} />
        </div>
      ))}
      <button onClick={() => { setPumps({ A: "OFF", B: "OFF", C: "OFF" }); send("STOP_ALL"); }} disabled={busy}
        className="btn btn-red" style={{ marginTop: 2, padding: "8px", fontSize: 11 }}>
        ■ STOP ALL PUMPS
      </button>
      {last && <div style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--text-dim)", textAlign: "center" }}>CMD: <span style={{ color: "var(--cyan)" }}>{last}</span></div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TANK WIDGET
═══════════════════════════════════════════════ */
function TankWidget() {
  const navigate = useNavigate();
  const [lv, setLv] = useState(0.6);
  useEffect(() => { const id = setInterval(() => setLv(p => Math.max(0.1, Math.min(0.95, p + (Math.random()-.5)*.04))), 2000); return () => clearInterval(id); }, []);
  const c = lv > 0.7 ? "#00FFB2" : lv > 0.4 ? "#FFB020" : "#FF4560";
  return (
    <div style={{ padding: "14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width="80" height="96" viewBox="0 0 80 96">
        <defs>
          <clipPath id="tc2"><rect x="15" y="8" width="50" height="80" rx="4" /></clipPath>
          <linearGradient id="wg2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity="0.9" />
            <stop offset="100%" stopColor={c} stopOpacity="0.25" />
          </linearGradient>
        </defs>
        <rect x="15" y="8" width="50" height="80" rx="4" fill="rgba(1,6,14,0.85)" stroke="rgba(0,212,255,0.16)" strokeWidth="1.5" />
        <rect x="16" y={8+80*(1-lv)} width="48" height={80*lv} fill="url(#wg2)" clipPath="url(#tc2)" style={{ transition: "y .8s ease, height .8s ease" }} />
        {[18,36,55,73].map(y => <rect key={y} x="15" y={y} width="50" height="1.5" fill="rgba(1,6,14,0.8)" stroke="rgba(0,212,255,0.08)" strokeWidth="0.5" />)}
        <text x="40" y="53" textAnchor="middle" fill="var(--text-primary)" fontSize="12" fontWeight="700" fontFamily="var(--f-mono)">{Math.round(lv*100)}%</text>
      </svg>
      <button onClick={() => navigate("/chamber")} className="btn btn-ghost" style={{ padding: "5px 12px", fontSize: 10, letterSpacing: "0.08em" }}>
        3D Chamber →
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   HOME PAGE
═══════════════════════════════════════════════ */
export default function Home() {
  const [pts, setPts] = useState<SensorPt[]>(() =>
    Array.from({ length: 20 }, (_, i) => ({
      t: new Date(Date.now() - (19-i)*TICK_MS).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      ph: 6.8 + Math.random()*1.2, turb: 1 + Math.random()*4, tds: 200 + Math.random()*300,
    }))
  );
  const [pred, setPred]         = useState<Prediction | null>(null);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const driftRef = useRef({ ph: 7.2, turb: 2.8, tds: 320 });

  // Sensor drift
  useEffect(() => {
    const id = setInterval(() => {
      const d = driftRef.current;
      d.ph   = drift(d.ph,   5.8, 8.6, 0.04);
      d.turb = drift(d.turb, 0.4, 9.8, 0.10);
      d.tds  = drift(d.tds,  75,  950, 3.0);
      const t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setPts(p => [...p.slice(-MAX_PTS+1), { t, ph: d.ph, turb: d.turb, tds: d.tds }]);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Poll backend
  useEffect(() => {
    const poll = async () => {
      try { const r = await fetch(`${BACKEND}/`); setBackendOk(r.ok); } catch { setBackendOk(false); }
      try { const r = await fetch(`${BACKEND}/prediction/latest`); if (r.ok) setPred(await r.json()); } catch {}
    };
    poll();
    const id = setInterval(poll, 8000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="page anim-fade-up">
      {/* ── Hero verdict (full width) ── */}
      <div style={{ marginBottom: 12 }}>
        <HeroVerdict pred={pred} />
      </div>

      {/* ── Sensor KPI strip (full width) ── */}
      <div style={{ marginBottom: 12 }}>
        <SensorStrip pts={pts} />
      </div>

      {/* ── Main grid ── */}
      <div className="grid-home" style={{ display: "grid", gridTemplateColumns: "224px 1fr 224px", gap: 12 }}>

        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Card title="Water Quality Index" accent="var(--cyan)">
            <WQIGauge wqi={pred?.wqi ?? null} />
          </Card>
          <Card title="Sensor Health" accent="var(--emerald)">
            <SensorHealth flat={pred?.flatline ?? null} />
          </Card>
          <Card title="Auto-Recalibration" accent="var(--amber)">
            <RecalPanel recal={pred?.recalibration ?? null} />
          </Card>
          <Card title="Chamber View" accent="var(--cyan)">
            <TankWidget />
          </Card>
        </div>

        {/* CENTER COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Live chart — tallest card */}
          <Card title="Live Telemetry" accent="var(--cyan)" live style={{ minHeight: 230 }}>
            <LiveChart pts={pts} />
          </Card>

          {/* Confidence + Fingerprint side-by-side */}
          <div className="center-sub-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Card title="Sensor Confidence" accent="var(--cyan)">
              <ConfidencePanel conf={pred?.confidence ?? null} />
            </Card>
            <Card title="Cycle Fingerprint" accent="var(--amber)">
              <FingerprintPanel fp={pred?.cycleFingerprint ?? null} />
            </Card>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Card title="System Status" accent="var(--cyan)">
            <SystemStatus pred={pred} backendOk={backendOk} />
          </Card>
          <Card title="Pump Control" accent="var(--amber)">
            <PumpControl />
          </Card>
        </div>
      </div>

      {/* ── Responsive overrides ── */}

    </div>
  );
}
