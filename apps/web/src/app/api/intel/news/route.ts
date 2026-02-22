import { NextResponse } from "next/server";

const FALLBACK_SENTIMENTS = ["STABLE", "NEUTRAL", "UNREST"] as const;

export async function GET() {
  const now = Date.now();
  const cycle = Math.floor(now / 60_000) % FALLBACK_SENTIMENTS.length;
  const sentiment = FALLBACK_SENTIMENTS[cycle];

  return NextResponse.json({
    source: "local-fallback",
    region: "global",
    query: "global",
    generated_at_ms: now,
    sentiment_score: sentiment === "STABLE" ? 0.72 : sentiment === "UNREST" ? 0.33 : 0.5,
    sentiment_label: sentiment,
    headlines: [
      {
        source: "HARPY",
        title: "Local intel fallback active (AIP offline or disabled).",
        url: "#",
        published_ts_ms: now - 40_000,
      },
      {
        source: "SYS",
        title: "Operator HUD remains live with deterministic streaming.",
        url: "#",
        published_ts_ms: now - 120_000,
      },
      {
        source: "OPS",
        title: "Set NEXT_PUBLIC_AIP_URL to enable upstream intel proxy mode.",
        url: "#",
        published_ts_ms: now - 300_000,
      },
    ],
  });
}

