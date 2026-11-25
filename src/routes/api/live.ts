import { createFileRoute } from "@tanstack/react-router";
import { loadLive } from "@/lib/live/load.server";

/**
 * Election headlines from the outlets' own feeds, as JSON for the Live page.
 * The CDN keeps an answer for a minute and may serve it for five more while it
 * refreshes, so readers never wait on the outlets' servers.
 */
export const Route = createFileRoute("/api/live")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // TEMPORARY PROBE (preview only, removed before release)
        const probe = new URL(request.url).searchParams.get("probe");
        if (probe) {
          const { LIVE_OUTLETS, decodeFeed, parseFeed } = await import("@/lib/live/feeds");
          const outlet = LIVE_OUTLETS.find((o) => o.id === probe);
          if (!outlet) return new Response("no outlet", { status: 404 });
          const res = await fetch(outlet.feeds[0], { headers: { "user-agent": "Mesa29N/1.0 (+https://mesa-29n.vercel.app; election desk headline reader)" } });
          const bytes = new Uint8Array(await res.arrayBuffer());
          const xml = decodeFeed(bytes, res.headers.get("content-type"));
          const first = /<(item|entry)\b[\s\S]*?<\/\1>/i.exec(xml)?.[0] ?? "";
          const entries = parseFeed(xml);
          return new Response(
            JSON.stringify({ status: res.status, type: res.headers.get("content-type"), bytes: bytes.length, head: xml.slice(0, 500), first: first.slice(0, 1800), parsed: entries.length, sample: entries.slice(0, 6).map((e) => ({ ...e, context: e.context.slice(0, 160) })) }),
            { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } },
          );
        }
        const payload = await loadLive();
        const answered = payload.sources.some((source) => source.ok);
        return new Response(JSON.stringify(payload), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": answered
              ? "public, max-age=0, s-maxage=60, stale-while-revalidate=300"
              : "public, max-age=0, s-maxage=15",
          },
        });
      },
    },
  },
});
