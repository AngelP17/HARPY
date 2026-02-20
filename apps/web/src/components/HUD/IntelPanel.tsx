"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Globe, TrendingUp } from "lucide-react";
import { clsx } from "clsx";
import styles from "./HUD.module.css";

interface NewsHeadline {
  source: string;
  title: string;
  url: string;
  published_ts_ms: number;
}

interface NewsBriefResponse {
  source: string;
  region: string;
  query: string;
  generated_at_ms: number;
  sentiment_score: number;
  sentiment_label: string;
  headlines: NewsHeadline[];
}

interface MarketInstrument {
  symbol: string;
  price_usd: number;
  change_24h_pct: number;
}

interface MarketSnapshotResponse {
  source: string;
  generated_at_ms: number;
  commodities: MarketInstrument[];
  crypto: MarketInstrument[];
}

const defaultNewsBrief = (): NewsBriefResponse => ({
  source: "local-fallback",
  region: "global",
  query: "global",
  generated_at_ms: Date.now(),
  sentiment_score: 0.5,
  sentiment_label: "NEUTRAL",
  headlines: [
    {
      source: "HARPY",
      title: "INTEL_LINK_STANDBY: Awaiting uplink or API key",
      url: "#",
      published_ts_ms: Date.now(),
    },
  ],
});

const defaultMarketSnapshot = (): MarketSnapshotResponse => ({
  source: "local-fallback",
  generated_at_ms: Date.now(),
  commodities: [
    { symbol: "WTI", price_usd: 78.0, change_24h_pct: 0.0 },
    { symbol: "GOLD", price_usd: 2110.0, change_24h_pct: 0.0 },
  ],
  crypto: [
    { symbol: "BTC", price_usd: 64200.0, change_24h_pct: 0.0 },
    { symbol: "ETH", price_usd: 3180.0, change_24h_pct: 0.0 },
  ],
});

const formatSignedPercent = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded >= 0 ? "+" : ""}${rounded.toFixed(2)}%`;
};

const formatPrice = (value: number): string => {
  if (value >= 1000) {
    return `$${Math.round(value).toLocaleString()}`;
  }
  return `$${value.toFixed(2)}`;
};

const IntelPanel: React.FC = () => {
  const [news, setNews] = useState<NewsBriefResponse>(defaultNewsBrief);
  const [market, setMarket] = useState<MarketSnapshotResponse>(defaultMarketSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const streamMode = (process.env.NEXT_PUBLIC_STREAM_MODE || "hybrid").toLowerCase();
  const isOfflineMode = streamMode === "offline";
  const aipUrl = process.env.NEXT_PUBLIC_AIP_URL || "http://localhost:8084";

  const sentimentBadgeClass = useMemo(
    () =>
      clsx(styles.freshnessBadge, {
        [styles.freshnessCritical]: news.sentiment_label === "CRITICAL",
        [styles.freshnessStale]: news.sentiment_label === "UNREST",
        [styles.freshnessAging]: news.sentiment_label === "NEUTRAL",
        [styles.freshnessFresh]: news.sentiment_label === "STABLE",
      }),
    [news.sentiment_label],
  );

  const refreshIntel = useCallback(async () => {
    if (isOfflineMode) {
      setNews(defaultNewsBrief());
      setMarket(defaultMarketSnapshot());
      setError(null);
      setLoading(false);
      return;
    }

    try {
      const [newsResponse, marketResponse] = await Promise.all([
        fetch(`${aipUrl}/intel/news`, { cache: "no-store" }),
        fetch(`${aipUrl}/intel/market`, { cache: "no-store" }),
      ]);

      if (!newsResponse.ok || !marketResponse.ok) {
        throw new Error("Intel service unavailable");
      }

      const newsBody = (await newsResponse.json()) as NewsBriefResponse;
      const marketBody = (await marketResponse.json()) as MarketSnapshotResponse;

      setNews(newsBody);
      setMarket(marketBody);
      setError(null);
    } catch (refreshError) {
      setNews(defaultNewsBrief());
      setMarket(defaultMarketSnapshot());
      const message = refreshError instanceof Error ? refreshError.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [aipUrl, isOfflineMode]);

  useEffect(() => {
    void refreshIntel();
    const intervalId = window.setInterval(() => {
      void refreshIntel();
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshIntel]);

  return (
    <div className={clsx("hud-panel", styles.intelPanel)}>
      <div className={styles.panelHeader}>
        <Globe size={14} />
        <span>INTEL_FEED</span>
        <span className={sentimentBadgeClass}>{news.sentiment_label}</span>
      </div>

      <div className={styles.intelSection}>
        <div className={styles.providerMeta}>
          <span>{news.region.toUpperCase()}</span>
          <span>SCORE {news.sentiment_score.toFixed(2)}</span>
        </div>

        <div className={styles.intelHeadlines}>
          {news.headlines.slice(0, 3).map((headline) => (
            <div key={`${headline.source}-${headline.title}`} className={styles.intelHeadlineItem}>
              <span className={styles.providerIdLabel}>{headline.source}</span>
              <span className={styles.intelHeadlineTitle}>{headline.title}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.separator} style={{ margin: "8px 0", height: "1px", width: "100%" }} />

      <div className={styles.panelHeader}>
        <TrendingUp size={14} />
        <span>MARKET_SNAPSHOT</span>
      </div>
      <div className={styles.intelMarketGrid}>
        {[...market.crypto.slice(0, 2), ...market.commodities.slice(0, 2)].map((instrument) => (
          <div key={instrument.symbol} className={styles.intelMarketRow}>
            <span>{instrument.symbol}</span>
            <span>{formatPrice(instrument.price_usd)}</span>
            <span
              className={clsx({
                [styles.freshnessFresh]: instrument.change_24h_pct >= 0,
                [styles.freshnessCritical]: instrument.change_24h_pct < 0,
              })}
            >
              {formatSignedPercent(instrument.change_24h_pct)}
            </span>
          </div>
        ))}
      </div>

      {loading ? <div className={styles.label}>UPLINKING_INTEL...</div> : null}
      {error ? <div className={styles.critical}>INTEL_LINK_DEGRADED: {error}</div> : null}
    </div>
  );
};

export default IntelPanel;
