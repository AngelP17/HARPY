// Live acceptance lane. Runs against a freshly exported archive built from TODAY's upstream data.
// This is the only check allowed to claim "live data works". Usage: node scripts/live-acceptance.mjs <site/data/v1>
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] || "site/data/v1";
const now = Date.now();
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail });

const meta = read("meta.json");
check("archive generated in the last 15 min", now - meta.generated_at < 15 * 60_000, new Date(meta.generated_at).toISOString());
check("contract version", meta.contract_version === "harpy.observation/1", meta.contract_version);

const providers = Object.fromEntries(read("providers.json").providers.map((p) => [p.source_id, p]));
for (const id of ["usgs", "celestrak"]) {
  const p = providers[id];
  check(`${id} provider reachable`, p && (p.state === "HEALTHY" || p.state === "DEGRADED"), `${p?.state} ${p?.last_error ?? ""}`.trim());
}

const index = read("earthquakes/index.json");
const today = new Date(now).toISOString().slice(0, 10);
const yesterday = new Date(now - 86_400_000).toISOString().slice(0, 10);
const quakes = [];
for (const d of [yesterday, today]) {
  const f = join(root, `earthquakes/day/${d}.json`);
  if (existsSync(f)) quakes.push(...JSON.parse(readFileSync(f, "utf8")).observations);
}
const last24 = quakes.filter((q) => now - q.observed_at <= 86_400_000);
check("USGS events in the last 24 h", last24.length > 0, `${last24.length} events`);
check(
  "USGS IDs look like real network event IDs",
  last24.every((q) => /^[a-z]{2}[a-z0-9]{4,}$/.test(q.upstream_id) && q.observation_id === `usgs:${q.upstream_id}`),
);
check("every event links back to its USGS event page", last24.every((q) => q.source_url?.startsWith("https://earthquake.usgs.gov/")));
check("no event is in the future", last24.every((q) => q.observed_at <= now + 60_000));
check("every event has a 64-hex record digest", last24.every((q) => /^[0-9a-f]{64}$/.test(q.raw_payload_digest)));
check("hourly histogram populated", index.hourly.length > 0, `${index.hourly.length} hours`);

const sats = read("satellites/latest.json").observations;
const iss = sats.find((s) => s.attributes.norad_id === 25544);
check("ISS element set present", iss, iss ? new Date(iss.observed_at).toISOString() : "missing");
check("ISS elements within 3 days", iss && Math.abs(now - iss.observed_at) < 3 * 86_400_000);
check("satellite element sets carry OMM for client SGP4", sats.length > 0 && sats.every((s) => s.attributes.omm?.NORAD_CAT_ID));

const failed = results.filter((r) => !r.ok);
const lines = ["### Live acceptance", "", "| check | result | detail |", "|---|---|---|"];
for (const r of results) lines.push(`| ${r.name} | ${r.ok ? "pass" : "**FAIL**"} | ${r.detail} |`);
const md = lines.join("\n") + "\n";
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
for (const f of failed) console.log(`::error title=live acceptance::${f.name} ${f.detail}`);
process.exit(failed.length ? 1 : 0);
