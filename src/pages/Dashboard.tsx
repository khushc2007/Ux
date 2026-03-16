import { useState, useEffect, useRef, useCallback } from "react";
import { fetchRecentReadings } from "../lib/aggregator";
import { calcWQI, calcBracket } from "../lib/dataSimulator";

/* ═══════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════ */
interface RawReading {
  ph: number;
  tds: number;
  turbidity: number;
  timestamp: string;
}

interface Row {
  id: number;
  ts: string;          // formatted
  tsRaw: string;       // ISO for sorting
  ph: number;
  turbidity: number;
  tds: number;
  wqi: number;
  bracket: string;
  decision: "REUSE" | "DISCARD" | "RE-TREAT";
  isNew?: boolean;
}

/* ═══════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════ */
function fmtTs(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) +
    " " + d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

function toRow(r: RawReading, idx: number, newSet: Set<string>): Row {
  const wqi     = calcWQI(r.ph, r.turbidity, r.tds);
  const bracket = calcBracket(r.turbidity, r.tds);
  const decision: Row["decision"] =
    bracket === "F1" || bracket === "F2" ? "REUSE"
    : bracket === "F3" ? "RE-TREAT"
    : "DISCARD";
  return {
    id: idx + 1,
    ts: fmtTs(r.timestamp),
    tsRaw: r.timestamp,
    ph: r.ph, turbidity: r.turbidity, tds: r.tds,
    wqi, bracket, decision,
    isNew: newSet.has(r.timestamp),
  };
}

function bracketColor(b: string): string {
  return b === "F1" ? "var(--emerald)" : b === "F2" ? "var(--cyan)" : b === "F3" ? "var(--amber)" : b === "F4" ? "#f97316" : "var(--red)";
}

function wqiColor(s: number): string {
  return s >= 80 ? "var(--emerald)" : s >= 65 ? "var(--cyan)" : s >= 50 ? "var(--amber)" : s >= 30 ? "#f97316" : "var(--red)";
}

/* ═══════════════════════════════════════════════
   EXPANDABLE METRIC CARD
═══════════════════════════════════════════════ */
function MetricCard({
  label, value, sub, accent, expanded, onToggle, children,
}: {
  label: string; value: string | number; sub?: string; accent: string;
  expanded: boolean; onToggle: () => void; children?: React.ReactNode;
}) {
  return (
    <div
      className="g-card"
      style={{
        display: "flex", flexDirection: "column", cursor: "pointer",
        transform: expanded ? "scale(1.01)" : "scale(1)",
        transition: "transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s ease",
        border: expanded ? "1px solid var(--border-bright)" : undefined,
      }}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onToggle()}
    >
      {/* Always-visible summary */}
      <div style={{ padding: "14px 16px" }}>
        <div style={{
          fontFamily: "var(--f-heading)", fontSize: 9, fontWeight: 600,
          letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-secondary)",
          marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {label}
          <span style={{ color: "var(--text-dim)", fontSize: 9, transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block" }}>▼</span>
        </div>
        <div style={{
          fontFamily: "var(--f-display)", fontSize: 26, fontWeight: 900,
          color: accent, lineHeight: 1, letterSpacing: "0.04em",
        }}>
          {value}
        </div>
        {sub && (
          <div style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--text-secondary)", marginTop: 4 }}>
            {sub}
          </div>
        )}
      </div>

      {/* Expandable detail */}
      <div style={{
        maxHeight: expanded ? "320px" : "0",
        overflow: "hidden",
        transition: "max-height 0.38s cubic-bezier(0.4,0,0.2,1)",
      }}>
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px 14px" }}
          onClick={e => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   HOURLY BAR CHART (SVG, no deps)
═══════════════════════════════════════════════ */
function HourlyBars({ rows }: { rows: Row[] }) {
  const buckets: Record<number, number> = {};
  rows.forEach(r => {
    const h = new Date(r.tsRaw).getHours();
    buckets[h] = (buckets[h] ?? 0) + 1;
  });
  const hours = Array.from({ length: 24 }, (_, h) => ({ h, count: buckets[h] ?? 0 }));
  const max = Math.max(...hours.map(x => x.count), 1);
  const W = 300, H = 60, bW = W / 24 - 1;
  return (
    <div>
      <div style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--text-secondary)", marginBottom: 6 }}>Readings per hour today</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="60" style={{ display: "block" }}>
        {hours.map(({ h, count }) => {
          const barH = (count / max) * (H - 8);
          return (
            <g key={h}>
              <rect
                x={h * (bW + 1)} y={H - barH - 4} width={bW} height={barH + 4}
                rx="2" fill="var(--cyan)" opacity={count > 0 ? 0.7 : 0.08}
              />
              {h % 6 === 0 && (
                <text x={h * (bW + 1) + bW / 2} y={H} textAnchor="middle"
                  fill="var(--text-dim)" fontSize="5" fontFamily="var(--f-mono)">{h}h</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   WQI HISTOGRAM
═══════════════════════════════════════════════ */
function WQIHistogram({ rows }: { rows: Row[] }) {
  const bins = [0, 20, 40, 60, 80, 100];
  const counts = bins.slice(0, -1).map((lo, i) => ({
    lo, hi: bins[i + 1],
    count: rows.filter(r => r.wqi >= lo && r.wqi < bins[i + 1]).length,
  }));
  const max = Math.max(...counts.map(c => c.count), 1);
  return (
    <div>
      <div style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--text-secondary)", marginBottom: 8 }}>WQI score distribution</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {counts.map(c => (
          <div key={c.lo} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: wqiColor((c.lo + c.hi) / 2), minWidth: 44 }}>
              {c.lo}–{c.hi}
            </span>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(0,212,255,0.06)", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${(c.count / max) * 100}%`,
                background: wqiColor((c.lo + c.hi) / 2),
                borderRadius: 4, transition: "width 0.6s ease",
              }} />
            </div>
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--text-secondary)", minWidth: 20, textAlign: "right" }}>{c.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   BRACKET BREAKDOWN
═══════════════════════════════════════════════ */
function BracketBreakdown({ rows }: { rows: Row[] }) {
  const brackets = ["F1", "F2", "F3", "F4", "F5"];
  const counts = brackets.map(b => ({ b, count: rows.filter(r => r.bracket === b).length }));
  const max = Math.max(...counts.map(c => c.count), 1);
  return (
    <div>
      <div style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--text-secondary)", marginBottom: 8 }}>Bracket distribution today</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {counts.map(({ b, count }) => (
          <div key={b} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={`badge badge-${b === "F1" || b === "F2" ? "emerald" : b === "F3" ? "amber" : "red"}`}
              style={{ minWidth: 32, justifyContent: "center" }}>{b}</span>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(0,212,255,0.06)", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${(count / max) * 100}%`,
                background: bracketColor(b), borderRadius: 4, transition: "width 0.6s ease",
              }} />
            </div>
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--text-secondary)", minWidth: 20, textAlign: "right" }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   LAST 5 DECISIONS MINI TIMELINE
═══════════════════════════════════════════════ */
function MiniTimeline({ rows }: { rows: Row[] }) {
  const last5 = rows.slice(-5).reverse();
  const decisionColor = (d: string) => d === "REUSE" ? "var(--emerald)" : d === "RE-TREAT" ? "var(--amber)" : "var(--red)";
  return (
    <div>
      <div style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--text-secondary)", marginBottom: 8 }}>Last 5 decisions</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {last5.map((r, i) => (
          <div key={r.tsRaw} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 8px", borderRadius: "var(--r-sm)",
            background: i === 0 ? "rgba(0,212,255,0.05)" : "var(--bg-inset)",
            border: `1px solid ${i === 0 ? "var(--border-mid)" : "var(--border)"}`,
          }}>
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--text-dim)", minWidth: 70 }}>{r.ts.split(" ")[0]}</span>
            <span className={`badge badge-${r.bracket === "F1" || r.bracket === "F2" ? "cyan" : r.bracket === "F3" ? "amber" : "red"}`}>{r.bracket}</span>
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 9, fontWeight: 700, color: decisionColor(r.decision), marginLeft: "auto" }}>{r.decision}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════ */
export default function Dashboard() {
  const [rows, setRows]         = useState<Row[]>([]);
  const [todayRows, setTodayRows] = useState<Row[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const prevTsSet               = useRef<Set<string>>(new Set());
  const tableBodyRef            = useRef<HTMLDivElement>(null);

  const toggleExpand = useCallback((i: number) => {
    setExpanded(p => p === i ? null : i);
  }, []);

  const fetchAndProcess = useCallback(async () => {
    const raw: RawReading[] = await fetchRecentReadings(100) as RawReading[];
    if (!raw.length) { setLoading(false); return; }

    // Detect new rows
    const newTsSet = new Set(raw.map(r => r.timestamp));
    const newKeys  = new Set([...newTsSet].filter(t => !prevTsSet.current.has(t)));
    prevTsSet.current = newTsSet;

    const processed = raw
      .slice()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 100)
      .map((r, i) => toRow(r, i, newKeys));

    // Today's rows for metrics
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const today = processed.filter(r => new Date(r.tsRaw) >= todayStart);

    setRows(processed);
    setTodayRows(today);
    setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setLoading(false);

    // Clear isNew after animation
    setTimeout(() => {
      setRows(p => p.map(r => ({ ...r, isNew: false })));
    }, 1200);
  }, []);

  useEffect(() => {
    fetchAndProcess();
    const id = setInterval(fetchAndProcess, 3500);
    return () => clearInterval(id);
  }, [fetchAndProcess]);

  // Metrics
  const totalToday    = todayRows.length;
  const avgWQI        = todayRows.length ? +(todayRows.reduce((s, r) => s + r.wqi, 0) / todayRows.length).toFixed(1) : 0;
  const reuseCount    = todayRows.filter(r => r.bracket === "F1" || r.bracket === "F2").length;
  const reuseRate     = todayRows.length ? +((reuseCount / todayRows.length) * 100).toFixed(1) : 0;
  const lastRow       = rows[0];
  const decisionColor = (d?: string) => d === "REUSE" ? "var(--emerald)" : d === "RE-TREAT" ? "var(--amber)" : d === "DISCARD" ? "var(--red)" : "var(--text-secondary)";

  return (
    <div className="page anim-fade-up">

      {/* ── METRIC CARDS ROW ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 10,
        marginBottom: 16,
      }}
        className="dash-metric-grid"
      >
        {/* Card 1 — Total Readings */}
        <MetricCard
          label="Total Readings Today"
          value={totalToday}
          sub={`${rows.length} in last 100`}
          accent="var(--cyan)"
          expanded={expanded === 0}
          onToggle={() => toggleExpand(0)}
        >
          <HourlyBars rows={todayRows} />
        </MetricCard>

        {/* Card 2 — Avg WQI */}
        <MetricCard
          label="Avg WQI Today"
          value={avgWQI}
          sub="/100 water quality"
          accent={wqiColor(avgWQI)}
          expanded={expanded === 1}
          onToggle={() => toggleExpand(1)}
        >
          <WQIHistogram rows={todayRows} />
        </MetricCard>

        {/* Card 3 — Reuse Rate */}
        <MetricCard
          label="Reuse Rate"
          value={`${reuseRate}%`}
          sub={`${reuseCount} / ${totalToday} today`}
          accent="var(--emerald)"
          expanded={expanded === 2}
          onToggle={() => toggleExpand(2)}
        >
          <BracketBreakdown rows={todayRows} />
        </MetricCard>

        {/* Card 4 — Last Decision */}
        <MetricCard
          label="Last Decision"
          value={lastRow?.decision ?? "—"}
          sub={lastRow ? `${lastRow.bracket} · ${lastRow.ts.split(" ")[0]}` : "no data yet"}
          accent={decisionColor(lastRow?.decision)}
          expanded={expanded === 3}
          onToggle={() => toggleExpand(3)}
        >
          <MiniTimeline rows={rows} />
        </MetricCard>
      </div>

      {/* ── LIVE FEED ── */}
      <div className="g-card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Feed header */}
        <div className="g-card-header" style={{ padding: "10px 16px", flexShrink: 0 }}>
          <span className="g-card-accent-bar" style={{ background: "var(--cyan)" }} />
          <span className="g-card-header-label" style={{ fontFamily: "var(--f-display)", letterSpacing: "0.1em" }}>
            LIVE READINGS
          </span>
          <span style={{
            marginLeft: 12, display: "flex", alignItems: "center", gap: 5,
            fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--emerald)", fontWeight: 700,
          }}>
            <span className="dot dot-live" style={{ width: 6, height: 6 }} />
            LIVE
          </span>
          <span style={{
            marginLeft: 8, fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--text-dim)",
            padding: "2px 8px", borderRadius: 4, background: "var(--bg-inset)", border: "1px solid var(--border)",
          }}>
            {rows.length} rows
          </span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--f-mono)", fontSize: 8, color: "var(--text-dim)" }}>
            {lastUpdated ? `updated ${lastUpdated}` : "loading…"}
          </span>
        </div>

        {/* Sticky table header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "48px 1fr 80px 80px 80px 70px 56px 90px",
          gap: 0,
          padding: "7px 16px",
          borderBottom: "1px solid var(--border)",
          background: "rgba(1,6,14,0.90)",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 2,
          minWidth: 640,
        }}>
          {["#", "TIMESTAMP", "pH", "TURBIDITY", "TDS", "WQI", "BRACKET", "DECISION"].map(h => (
            <div key={h} style={{
              fontFamily: "var(--f-heading)", fontSize: 8, fontWeight: 700,
              letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-dim)",
              paddingRight: 8,
            }}>{h}</div>
          ))}
        </div>

        {/* Scrollable body */}
        <div
          ref={tableBodyRef}
          style={{
            overflowY: "auto",
            overflowX: "auto",
            maxHeight: "calc(100dvh - 420px)",
            minHeight: 200,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {loading && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              height: 120, gap: 10,
              fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--text-secondary)",
            }}>
              <span className="dot dot-live" style={{ width: 6, height: 6 }} />
              Fetching live readings…
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              height: 120,
              fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--text-dim)",
            }}>
              No readings yet — simulator warming up
            </div>
          )}

          <div style={{ minWidth: 640 }}>
            {rows.map((row) => (
              <div
                key={row.tsRaw}
                style={{
                  display: "grid",
                  gridTemplateColumns: "48px 1fr 80px 80px 80px 70px 56px 90px",
                  gap: 0,
                  padding: "0 16px",
                  minHeight: 44,
                  alignItems: "center",
                  borderBottom: "1px solid rgba(0,212,255,0.04)",
                  transition: "background 0.3s ease, transform 0.35s cubic-bezier(0.22,1,0.36,1), opacity 0.35s ease",
                  background: row.isNew ? "rgba(0,212,255,0.07)" : "transparent",
                  animation: row.isNew ? "fadeUp 0.38s cubic-bezier(0.22,1,0.36,1) both" : "none",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,212,255,0.03)")}
                onMouseLeave={e => (e.currentTarget.style.background = row.isNew ? "rgba(0,212,255,0.07)" : "transparent")}
              >
                {/* # */}
                <div style={{ fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--text-dim)" }}>
                  {row.id}
                </div>

                {/* Timestamp */}
                <div style={{ fontFamily: "var(--f-mono)", fontSize: 9, color: "var(--text-secondary)", paddingRight: 8 }}>
                  {row.ts}
                </div>

                {/* pH */}
                <div style={{
                  fontFamily: "var(--f-mono)", fontSize: 10, fontWeight: 700,
                  color: row.ph < 6.5 || row.ph > 8.5 ? "var(--red)" : "var(--cyan)",
                  paddingRight: 8,
                }}>
                  {row.ph.toFixed(2)}
                  {(row.ph < 6.5 || row.ph > 8.5) && <span style={{ fontSize: 7, marginLeft: 3, color: "var(--red)" }}>!</span>}
                </div>

                {/* Turbidity */}
                <div style={{
                  fontFamily: "var(--f-mono)", fontSize: 10, fontWeight: 700,
                  color: row.turbidity > 30 ? "var(--red)" : "var(--amber)",
                  paddingRight: 8,
                }}>
                  {row.turbidity.toFixed(1)}
                  <span style={{ fontSize: 7, color: "var(--text-dim)", marginLeft: 2 }}>NTU</span>
                  {row.turbidity > 30 && <span style={{ fontSize: 7, marginLeft: 3, color: "var(--red)" }}>!</span>}
                </div>

                {/* TDS */}
                <div style={{
                  fontFamily: "var(--f-mono)", fontSize: 10, fontWeight: 700,
                  color: row.tds > 1000 ? "var(--red)" : "var(--emerald)",
                  paddingRight: 8,
                }}>
                  {row.tds.toFixed(0)}
                  <span style={{ fontSize: 7, color: "var(--text-dim)", marginLeft: 2 }}>ppm</span>
                  {row.tds > 1000 && <span style={{ fontSize: 7, marginLeft: 3, color: "var(--red)" }}>!</span>}
                </div>

                {/* WQI */}
                <div style={{
                  fontFamily: "var(--f-mono)", fontSize: 10, fontWeight: 700,
                  color: wqiColor(row.wqi),
                  paddingRight: 8,
                }}>
                  {row.wqi.toFixed(0)}
                </div>

                {/* Bracket */}
                <div style={{ paddingRight: 8 }}>
                  <span
                    className={`badge badge-${row.bracket === "F1" || row.bracket === "F2" ? "cyan" : row.bracket === "F3" ? "amber" : "red"}`}
                    style={{ fontSize: 8 }}
                  >
                    {row.bracket}
                  </span>
                </div>

                {/* Decision */}
                <div>
                  <span
                    className={`badge badge-${row.decision === "REUSE" ? "emerald" : row.decision === "RE-TREAT" ? "amber" : "red"}`}
                    style={{ fontSize: 8 }}
                  >
                    {row.decision}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RESPONSIVE STYLES ── */}
      <style>{`
        @media (max-width: 767px) {
          .dash-metric-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 400px) {
          .dash-metric-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
