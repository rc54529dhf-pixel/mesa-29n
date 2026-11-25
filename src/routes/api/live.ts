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
      GET: async () => {
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
