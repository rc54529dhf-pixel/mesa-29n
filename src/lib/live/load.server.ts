import {
  LIVE_OUTLETS,
  decodeFeed,
  mergeItems,
  parseFeed,
  toItems,
  type LiveItem,
  type LiveOutlet,
  type LivePayload,
} from "./feeds";

const USER_AGENT = "Mesa29N/1.0 (+https://mesa-29n.vercel.app; election desk headline reader)";
const FEED_TIMEOUT_MS = 4500;
const MAX_FEED_BYTES = 4_000_000;
const MEMORY_TTL_MS = 60_000;

let memory: { at: number; payload: LivePayload } | null = null;
let inFlight: Promise<LivePayload> | null = null;

async function readOutlet(
  outlet: LiveOutlet,
  now: number,
): Promise<{ ok: boolean; items: LiveItem[] }> {
  for (const url of outlet.feeds) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": USER_AGENT,
          accept:
            "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      });
      if (!response.ok) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length === 0 || bytes.length > MAX_FEED_BYTES) continue;
      const entries = parseFeed(decodeFeed(bytes, response.headers.get("content-type")));
      if (entries.length === 0) continue;
      return { ok: true, items: toItems(outlet, entries, now) };
    } catch {
      // Try the outlet's next feed address, if it has one.
    }
  }
  return { ok: false, items: [] };
}

async function build(): Promise<LivePayload> {
  const now = Date.now();
  const results = await Promise.all(LIVE_OUTLETS.map((outlet) => readOutlet(outlet, now)));
  return {
    fetchedAt: now,
    items: mergeItems(results.map((result) => result.items)),
    sources: LIVE_OUTLETS.map((outlet, index) => ({
      id: outlet.id,
      name: outlet.name,
      ok: results[index].ok,
      kept: results[index].items.length,
    })),
  };
}

/**
 * The merged headline list. Kept in memory for a minute so a burst of requests
 * reads each outlet once; the CDN caches the response on top of that.
 */
export async function loadLive(): Promise<LivePayload> {
  if (memory && Date.now() - memory.at < MEMORY_TTL_MS) return memory.payload;
  if (!inFlight) {
    inFlight = build()
      .then((payload) => {
        // A round in which no outlet answered does not replace a good one.
        if (payload.sources.some((source) => source.ok) || !memory) {
          memory = { at: Date.now(), payload };
        }
        return memory ? memory.payload : payload;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}
