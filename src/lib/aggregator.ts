import { supabase } from "./supabase";
import { DEMO_ORG_ID, calcWQI, calcBracket } from "./dataSimulator";

// ─── How often to check if a 30-min window needs closing ─────────────────────
const CHECK_INTERVAL_MS = 60_000; // every 60 seconds

let lastAggregatedWindow: string | null = null;
let checkIntervalId: ReturnType<typeof setInterval> | null = null;

function windowStart(date: Date): Date {
  // Floor to nearest 30-min boundary
  const d = new Date(date);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() < 30 ? 0 : 30);
  return d;
}

function windowEnd(start: Date): Date {
  return new Date(start.getTime() + 30 * 60 * 1000);
}

async function aggregate() {
  const now        = new Date();
  const winStart   = windowStart(now);
  const winKey     = winStart.toISOString();

  // Only aggregate if this window hasn't been aggregated yet
  // AND the window is at least 2 minutes old (let readings accumulate)
  const ageMs = now.getTime() - winStart.getTime();
  if (winKey === lastAggregatedWindow || ageMs < 2 * 60 * 1000) return;

  // Check if we've already stored this window
  const { data: existing } = await supabase
    .from("readings_aggregated")
    .select("id")
    .eq("organization_id", DEMO_ORG_ID)
    .eq("window_start", winKey)
    .maybeSingle();

  if (existing) { lastAggregatedWindow = winKey; return; }

  // Pull raw readings in the previous completed 30-min window
  const prevWinEnd   = winStart;
  const prevWinStart = new Date(winStart.getTime() - 30 * 60 * 1000);

  const { data: rows, error } = await supabase
    .from("readings")
    .select("ph, tds, turbidity, timestamp")
    .eq("organization_id", DEMO_ORG_ID)
    .gte("timestamp", prevWinStart.toISOString())
    .lt("timestamp",  prevWinEnd.toISOString());

  if (error || !rows || rows.length === 0) return;

  // Compute means
  const mean_ph        = rows.reduce((s, r) => s + r.ph,        0) / rows.length;
  const mean_tds       = rows.reduce((s, r) => s + r.tds,       0) / rows.length;
  const mean_turbidity = rows.reduce((s, r) => s + r.turbidity, 0) / rows.length;
  const wqi_score      = calcWQI(mean_ph, mean_turbidity, mean_tds);
  const bracket        = calcBracket(mean_turbidity, mean_tds);
  const decision       = ["F1", "F2"].includes(bracket) ? "REUSE" : bracket === "F3" ? "RE-TREAT" : "DISCARD";

  // Write aggregated row
  const { error: insertErr } = await supabase.from("readings_aggregated").insert({
    organization_id: DEMO_ORG_ID,
    window_start:    prevWinStart.toISOString(),
    window_end:      prevWinEnd.toISOString(),
    mean_ph:         parseFloat(mean_ph.toFixed(2)),
    mean_tds:        parseFloat(mean_tds.toFixed(1)),
    mean_turbidity:  parseFloat(mean_turbidity.toFixed(1)),
    sample_count:    rows.length,
    wqi_score:       wqi_score,
    bracket,
    decision,
  });

  if (insertErr) {
    console.warn("[aggregator] insert failed:", insertErr.message);
    return;
  }

  lastAggregatedWindow = winKey;
  console.log(`[aggregator] wrote window ${prevWinStart.toISOString()} → ${rows.length} samples, WQI ${wqi_score}, ${bracket}`);

  // Purge raw rows older than 24 hours to keep the table lean
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { error: purgeErr } = await supabase
    .from("readings")
    .delete()
    .eq("organization_id", DEMO_ORG_ID)
    .lt("timestamp", cutoff);

  if (purgeErr) console.warn("[aggregator] purge failed:", purgeErr.message);
  else console.log(`[aggregator] purged raw readings older than ${cutoff}`);
}

/** Start the background aggregation loop. Safe to call multiple times. */
export function startAggregator() {
  if (checkIntervalId !== null) return;
  aggregate(); // check immediately on start
  checkIntervalId = setInterval(aggregate, CHECK_INTERVAL_MS);
}

/** Stop the aggregation loop. */
export function stopAggregator() {
  if (checkIntervalId !== null) { clearInterval(checkIntervalId); checkIntervalId = null; }
}

/** Fetch the last N aggregated windows for the history page. */
export async function fetchAggregatedHistory(limit = 48) {
  const { data, error } = await supabase
    .from("readings_aggregated")
    .select("*")
    .eq("organization_id", DEMO_ORG_ID)
    .order("window_start", { ascending: false })
    .limit(limit);

  if (error) { console.warn("[aggregator] fetch failed:", error.message); return []; }
  return data ?? [];
}

/** Fetch last N raw readings (for live chart + intraday browsing). */
export async function fetchRecentReadings(limit = 500) {
  const { data, error } = await supabase
    .from("readings")
    .select("ph, tds, turbidity, timestamp")
    .eq("organization_id", DEMO_ORG_ID)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error) { console.warn("[aggregator] fetch raw failed:", error.message); return []; }
  return (data ?? []).reverse(); // oldest first for charting
}
