export function utc(ms: number | null | undefined, withSeconds = true): string {
  if (ms == null || !Number.isFinite(ms)) return "n/a";
  const iso = new Date(ms).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, withSeconds ? 19 : 16)}Z`;
}

export function age(ms: number, now = Date.now()): string {
  const d = Math.round((now - ms) / 1000);
  const abs = Math.abs(d);
  const suffix = d >= 0 ? "ago" : "from now";
  if (abs < 60) return `${abs}s ${suffix}`;
  if (abs < 3600) return `${Math.round(abs / 60)}m ${suffix}`;
  if (abs < 86_400) return `${(abs / 3600).toFixed(abs < 36_000 ? 1 : 0)}h ${suffix}`;
  return `${(abs / 86_400).toFixed(1)}d ${suffix}`;
}

export function num(v: number | null | undefined, digits = 1): string {
  return v == null || !Number.isFinite(v) ? "n/a" : v.toFixed(digits);
}

export function coord(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(3)}°${ns} ${Math.abs(lon).toFixed(3)}°${ew}`;
}

export function shortDigest(d: string): string {
  return d.length > 12 ? `${d.slice(0, 8)}…${d.slice(-4)}` : d;
}

export function magColor(mag: number | null): string {
  if (mag == null) return "#8b93a1";
  if (mag >= 6) return "#ff3d5e";
  if (mag >= 5) return "#ff6a3d";
  if (mag >= 4) return "#ff9b3d";
  if (mag >= 2.5) return "#ffc94d";
  return "#e9e3a6";
}
