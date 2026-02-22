import { NextResponse } from "next/server";

const wobble = (seed: number, span: number): number => {
  const t = Date.now() / 60_000;
  return Math.sin(t + seed) * span;
};

export async function GET() {
  return NextResponse.json({
    source: "local-fallback",
    generated_at_ms: Date.now(),
    commodities: [
      {
        symbol: "WTI",
        price_usd: Number((78.2 + wobble(0.3, 0.8)).toFixed(2)),
        change_24h_pct: Number((wobble(1.7, 1.9)).toFixed(2)),
      },
      {
        symbol: "GOLD",
        price_usd: Number((2115 + wobble(0.8, 10)).toFixed(2)),
        change_24h_pct: Number((wobble(2.1, 0.9)).toFixed(2)),
      },
    ],
    crypto: [
      {
        symbol: "BTC",
        price_usd: Number((64100 + wobble(2.5, 260)).toFixed(2)),
        change_24h_pct: Number((wobble(0.5, 2.2)).toFixed(2)),
      },
      {
        symbol: "ETH",
        price_usd: Number((3180 + wobble(1.3, 22)).toFixed(2)),
        change_24h_pct: Number((wobble(3.2, 2.7)).toFixed(2)),
      },
    ],
  });
}

