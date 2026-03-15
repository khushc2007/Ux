export type FiltrationVisual = { label: string; src: string; type: "image" | "lottie" };

export const FILTRATION_LIBRARY: Record<string, {
  title: string; tank: string; status: string;
  contamination: string[]; method: string[];
  explanation: string; postUse: string[];
  risks: string[]; mitigation: string[];
  visuals: FiltrationVisual[];
}> = {
  F1: {
    title: "Baseline Polishing Filtration", tank: "Tank A",
    status: "Reusable (with baseline filtration)",
    contamination: [
      "Trace suspended particles such as sand, silt, rust flakes, and debris",
      "Minor organic residues from surface runoff and domestic discharge",
      "Aesthetic issues including color, odor, and taste inconsistencies",
    ],
    method: ["Sediment filtration", "Activated carbon filtration"],
    explanation:
      "F1 represents lightly contaminated water that is structurally safe but aesthetically impaired. Sediment filtration removes fine particulate matter that can clog systems or reduce clarity, while activated carbon adsorption removes dissolved organic compounds, chlorine residues, and odor-causing molecules.",
    postUse: ["Gardening and landscaping", "Toilet flushing", "Domestic cleaning", "Cooling water systems", "Light industrial washing"],
    risks: ["Carbon saturation over prolonged usage", "Sediment filter clogging", "Breakthrough of fine particles if maintenance is neglected"],
    mitigation: ["Scheduled filter replacement", "Backwashing mechanisms", "Parallel filtration units for redundancy"],
    visuals: [],
  },
  F2: {
    title: "Moderate Suspended Solids", tank: "Tank B",
    status: "Non-reusable (before treatment)",
    contamination: ["Moderate suspended solids", "Visible turbidity", "Particulate-induced flow instability"],
    method: ["Sand filtration", "Activated carbon filtration", "Fine polishing filters"],
    explanation:
      "F2 water contains suspended solids at levels that interfere with hydraulic performance and mechanical equipment. A staged filtration process removes progressively smaller particles.",
    postUse: ["Agricultural irrigation", "Construction activities", "Cooling towers", "Equipment and vehicle washing"],
    risks: ["Media saturation", "Channel formation"],
    mitigation: ["Layered filter beds", "Periodic media replacement", "Modular filtration design"],
    visuals: [],
  },
  F3: {
    title: "High Suspended Solids", tank: "Tank B",
    status: "Non-reusable (before treatment)",
    contamination: ["Very high suspended solids", "Organic and biological particulate load"],
    method: ["Coagulation", "Flocculation", "Sedimentation", "Rapid sand filtration"],
    explanation:
      "F3 water requires chemical destabilization of colloidal particles. Coagulants neutralize surface charges, forming flocs that settle during sedimentation.",
    postUse: ["Industrial reuse", "Construction supply", "Landscaping"],
    risks: ["Sludge accumulation", "Chemical overdosing"],
    mitigation: ["Automated dosing systems", "Sludge dewatering and disposal"],
    visuals: [],
  },
  F4: {
    title: "High Dissolved Solids", tank: "Tank B",
    status: "Non-reusable (before treatment)",
    contamination: ["High dissolved salts and ions", "Elevated electrical conductivity"],
    method: ["Ultrafiltration", "Activated carbon stabilization"],
    explanation:
      "F4 water is dominated by dissolved contaminants. Ultrafiltration removes colloids and biological matter while protecting downstream membranes.",
    postUse: ["Industrial process water", "Cooling systems", "Boiler feed with conditioning"],
    risks: ["Membrane fouling", "Pressure loss"],
    mitigation: ["Optimized pretreatment", "Scheduled membrane cleaning", "Continuous monitoring"],
    visuals: [],
  },
  F5: {
    title: "Severe Dissolved Contamination", tank: "Tank B",
    status: "Non-reusable (before treatment)",
    contamination: ["Extremely high dissolved solids", "Toxic ions and chemical pollutants"],
    method: ["Advanced reverse osmosis", "Electrodialysis", "Thermal desalination"],
    explanation:
      "F5 represents extreme contamination. Molecular-level separation technologies are required.",
    postUse: ["Industrial manufacturing", "Potable water after remineralization", "Emergency water supply"],
    risks: ["High operational cost", "Brine disposal challenges"],
    mitigation: ["Zero Liquid Discharge systems", "Energy recovery devices", "Brine recovery and reuse"],
    visuals: [],
  },
};

export const BRACKET_META: Record<string, {
  color: string; bg: string; border: string; icon: string; severity: string;
}> = {
  F1: { color: "#00ff9d", bg: "#001a0d",  border: "#00ff9d", icon: "✅", severity: "Low" },
  F2: { color: "#86efac", bg: "#001a0d",  border: "#86efac", icon: "🟡", severity: "Moderate" },
  F3: { color: "#f59e0b", bg: "#1a0f00",  border: "#f59e0b", icon: "⚠️", severity: "High" },
  F4: { color: "#f97316", bg: "#1a0800",  border: "#f97316", icon: "🔶", severity: "Very High" },
  F5: { color: "#ef4444", bg: "#1a0000",  border: "#ef4444", icon: "🚨", severity: "Critical" },
};
