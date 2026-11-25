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
        // On Vercel every function call carries a short-lived token for the
        // project. It pays for the English headlines through AI Gateway, so no
        // key is stored anywhere.
        const aiToken =
          request.headers.get("x-vercel-oidc-token") ??
          process.env.AI_GATEWAY_API_KEY ??
          process.env.VERCEL_OIDC_TOKEN ??
          undefined;
        const payload = await loadLive(aiToken);
        const answered = payload.sources.some((source) => source.ok);
        // "?view=status" answers with the health of the feeds and the translation only.
        if (new URL(request.url).searchParams.get("view") === "status") {
          return new Response(
            JSON.stringify({
              fetchedAt: payload.fetchedAt,
              headlines: payload.items.length,
              sources: payload.sources,
              translation: payload.translation,
            }),
            {
              headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": "public, max-age=0, s-maxage=30",
              },
            },
          );
        }
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
