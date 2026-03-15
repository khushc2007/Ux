import { supabase } from "./supabase";

// ─── Shared org ID — everyone sees the same data stream ───────────────────────
// This is the single organization all demo users share.
// Create one row in public.organizations and paste the UUID here.
// SQL: INSERT INTO public.organizations (name) VALUES ('WaterIQ Demo') RETURNING id;
export const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001";

// ─── Realistic sensor ranges ─────────────────────────────────────────────────
// Greywater from typical apartment building:
//   pH:        6.5 – 8.5  (slight drift, occasionally spikes)
//   Turbidity: 5 – 120 NTU (high variance, improves after EC treatment)
//   TDS:       200 – 1200 ppm (relatively stable, slow drift)

interface Reading {
  ph: number;
  turbidity: number;
  tds: number;
}

// Internal state — simulates slow drift + noise like real sensors
let state = {
  ph:        7.2,
  turbidity: 45,
  tds:       480,
  cycle:     0,      // treatment cycle counter
  phase:     "collecting" as "collecting" | "treating" | "settling",
  phaseStep: 0,
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function noise(scale: number) {
  // Box-Muller gaussian noise
  return scale * Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

function nextReading(): Reading {
  state.phaseStep++;

  // Cycle through phases: collecting (20 readings) → treating (30 readings) → settling (15 readings)
  if (state.phase === "collecting" && state.phaseStep > 20) {
    state.phase = "treating"; state.phaseStep = 0;
  } else if (state.phase === "treating" && state.phaseStep > 30) {
    state.phase = "settling"; state.phaseStep = 0;
  } else if (state.phase === "settling" && state.phaseStep > 15) {
    state.phase = "collecting"; state.phaseStep = 0; state.cycle++;
    // Reset to "dirty" water for next cycle
    state.turbidity = 60 + Math.random() * 50;
    state.tds       = 400 + Math.random() * 400;
    state.ph        = 6.8 + Math.random() * 0.8;
  }

  // Phase-dependent behaviour
  if (state.phase === "treating") {
    // EC treatment: turbidity drops, pH stabilises toward 7.0–7.5, TDS drops slightly
    state.turbidity -= 1.2 + Math.random() * 0.8;
    state.ph        += (7.2 - state.ph) * 0.04 + noise(0.04);
    state.tds       -= 3 + Math.random() * 4;
  } else if (state.phase === "settling") {
    // Lamella settling: turbidity drops faster, other params stable
    state.turbidity -= 2.5 + Math.random() * 1.5;
    state.ph        += noise(0.02);
    state.tds       += noise(5);
  } else {
    // Collecting: slow dirty-water drift
    state.turbidity += noise(3);
    state.ph        += noise(0.06);
    state.tds       += noise(12);
  }

  // Occasional sensor spike (1% chance) — simulates real noise
  if (Math.random() < 0.01) state.turbidity += 20 + Math.random() * 30;
  if (Math.random() < 0.01) state.ph        += (Math.random() - 0.5) * 0.8;

  state.ph        = clamp(state.ph,        5.5,  9.5);
  state.turbidity = clamp(state.turbidity, 2,    180);
  state.tds       = clamp(state.tds,       100,  1600);

  return {
    ph:        parseFloat(state.ph.toFixed(2)),
    turbidity: parseFloat(state.turbidity.toFixed(1)),
    tds:       parseFloat(state.tds.toFixed(0)),
  };
}

// ─── WQI calculation (mirrors backend Layer 1) ────────────────────────────────
export function calcWQI(ph: number, turbidity: number, tds: number): number {
  // Normalise each sensor 0–1 (0 = worst, 1 = best)
  const phScore        = ph >= 6.5 && ph <= 8.0 ? 1 : Math.max(0, 1 - Math.abs(ph - 7.25) / 2.5);
  const turbidityScore = Math.max(0, 1 - turbidity / 100);
  const tdsScore       = Math.max(0, 1 - (tds - 100) / 1400);

  // post_lamella weights (default)
  const wqi = (phScore * 0.25 + turbidityScore * 0.50 + tdsScore * 0.25) * 100;
  return parseFloat(clamp(wqi, 0, 100).toFixed(1));
}

export function calcBracket(turbidity: number, tds: number): string {
  if (tds > 1500)  return "F5";
  if (tds > 1000)  return "F4";
  if (turbidity > 30) return "F3";
  if (turbidity > 10) return "F2";
  return "F1";
}

// ─── Simulator singleton ─────────────────────────────────────────────────────
let intervalId: ReturnType<typeof setInterval> | null = null;
let subscribers: ((r: Reading & { wqi: number; bracket: string; ts: string }) => void)[] = [];

export function subscribeToReadings(
  cb: (r: Reading & { wqi: number; bracket: string; ts: string }) => void
): () => void {
  subscribers.push(cb);
  return () => { subscribers = subscribers.filter(s => s !== cb); };
}

async function tick() {
  const reading  = nextReading();
  const wqi      = calcWQI(reading.ph, reading.turbidity, reading.tds);
  const bracket  = calcBracket(reading.turbidity, reading.tds);
  const ts       = new Date().toISOString();
  const payload  = { ...reading, wqi, bracket, ts };

  // Notify local subscribers (for live chart etc.)
  subscribers.forEach(cb => cb(payload));

  // Write to Supabase — fire and forget, don't block the interval
  supabase.from("readings").insert({
    organization_id: DEMO_ORG_ID,
    ph:              reading.ph,
    turbidity:       reading.turbidity,
    tds:             reading.tds,
    timestamp:       ts,
  }).then(({ error }) => {
    if (error) console.warn("[simulator] insert failed:", error.message);
  });
}

/** Start emitting readings every 3.5 seconds. Safe to call multiple times. */
export function startSimulator() {
  if (intervalId !== null) return;
  tick(); // immediate first tick
  intervalId = setInterval(tick, 3500);
}

/** Stop the simulator (call on unmount if needed). */
export function stopSimulator() {
  if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
}
