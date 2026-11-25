import type { LiveItem, LiveTranslation } from "./feeds";
import { readTranslations, translationRequest } from "./translate";

const GATEWAY = "https://ai-gateway.vercel.sh/v1/chat/completions";
const CALL_TIMEOUT_MS = 9000;
/** New headlines translated per round; the rest wait for the next one. */
const BATCH = 40;
/** After a failed call, wait this long before trying again. */
const RETRY_AFTER_MS = 120_000;

const STORE_KEY = "mesa-29n-live-en-v1";
const STORE_TTL_SECONDS = 3 * 24 * 60 * 60;

/** Spanish headline → English, for this server instance. */
const known = new Map<string, string>();
/** Headlines the model has failed on, with the number of tries. They are left in Spanish after two. */
const failed = new Map<string, number>();
const MAX_TRIES = 2;
let lastFailureAt = 0;

type RuntimeCache = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown, options?: { ttl?: number; name?: string }) => Promise<unknown>;
};

/**
 * Vercel's runtime cache for this project, when the function runs on Vercel.
 * It keeps translations across server instances, so each headline is translated once.
 */
function runtimeCache(): RuntimeCache | null {
  const holder = (globalThis as Record<symbol, unknown>)[Symbol.for("@vercel/request-context")] as
    { get?: () => { cache?: RuntimeCache } | undefined } | undefined;
  const cache = holder?.get?.()?.cache;
  return cache && typeof cache.get === "function" && typeof cache.set === "function" ? cache : null;
}

async function recall(cache: RuntimeCache | null): Promise<void> {
  if (!cache) return;
  try {
    const stored = await cache.get(STORE_KEY);
    if (stored && typeof stored === "object") {
      for (const [es, en] of Object.entries(stored as Record<string, unknown>)) {
        if (typeof en === "string" && !known.has(es)) known.set(es, en);
      }
    }
  } catch {
    // The cache is a saving, not a requirement.
  }
}

async function remember(cache: RuntimeCache | null, titles: string[]): Promise<void> {
  if (!cache) return;
  const snapshot: Record<string, string> = {};
  for (const title of titles) {
    const en = known.get(title);
    if (en) snapshot[title] = en;
  }
  try {
    await cache.set(STORE_KEY, snapshot, { ttl: STORE_TTL_SECONDS, name: STORE_KEY });
  } catch {
    // As above.
  }
}

async function ask(
  titles: string[],
  token: string,
): Promise<{ english: (string | null)[]; status: number }> {
  const response = await fetch(GATEWAY, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(translationRequest(titles)),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  if (!response.ok) return { english: titles.map(() => null), status: response.status };
  const body = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
  return {
    english: readTranslations(body.choices?.[0]?.message?.content, titles.length),
    status: response.status,
  };
}

/**
 * Adds `titleEn` to the items that have a translation, translating up to one
 * batch of new headlines through Vercel AI Gateway. Without a token, or when
 * the gateway does not answer, the items simply keep their Spanish headline.
 */
export async function addEnglish(
  items: LiveItem[],
  token: string | undefined,
): Promise<LiveTranslation> {
  const titles = [...new Set(items.map((item) => item.title))];
  const cache = runtimeCache();
  let note = token ? "ok" : "no token";

  if (titles.some((title) => !known.has(title))) await recall(cache);

  const missing = titles
    .filter((title) => !known.has(title) && (failed.get(title) ?? 0) < MAX_TRIES)
    .slice(0, BATCH);
  if (missing.length > 0 && token && Date.now() - lastFailureAt > RETRY_AFTER_MS) {
    try {
      const { english, status } = await ask(missing, token);
      let added = 0;
      english.forEach((en, index) => {
        if (en) {
          known.set(missing[index], en);
          added += 1;
        } else {
          failed.set(missing[index], (failed.get(missing[index]) ?? 0) + 1);
        }
      });
      if (added > 0) {
        await remember(cache, titles);
      } else {
        lastFailureAt = Date.now();
        note = `gateway ${status}`;
      }
    } catch {
      lastFailureAt = Date.now();
      note = "gateway unreachable";
    }
  }

  // Forget headlines that have left the list.
  const current = new Set(titles);
  for (const title of known.keys()) if (!current.has(title)) known.delete(title);
  for (const title of failed.keys()) if (!current.has(title)) failed.delete(title);

  let translated = 0;
  for (const item of items) {
    const en = known.get(item.title);
    if (en) {
      item.titleEn = en;
      translated += 1;
    }
  }
  return {
    translated,
    pending: items.length - translated,
    store: cache ? "shared" : "instance",
    note,
  };
}
