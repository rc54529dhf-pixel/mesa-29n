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
        // TEMPORARY PROBE (preview branch only, removed before release): compare
        // candidate models on real headlines.
        if (new URL(request.url).searchParams.get("view") === "models" && aiToken) {
          const { translationRequest, readTranslations } = await import("@/lib/live/translate");
          const current = await loadLive(aiToken);
          const titles = current.items.slice(0, 40).map((item) => item.title);
          const auth = { authorization: `Bearer ${aiToken}`, "content-type": "application/json" };
          const rows = await Promise.all(
            ["google/gemini-2.5-flash", "google/gemini-2.5-flash-lite", "amazon/nova-lite"].map(async (model) => {
              const started = Date.now();
              try {
                const r = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
                  method: "POST",
                  headers: auth,
                  body: JSON.stringify({ ...translationRequest(titles), model, reasoning: { enabled: false } }),
                  signal: AbortSignal.timeout(25000),
                });
                const body = (await r.json()) as {
                  choices?: { message?: { content?: unknown } }[];
                  usage?: unknown;
                  error?: { message?: string };
                };
                const en = readTranslations(body.choices?.[0]?.message?.content, titles.length);
                return {
                  model,
                  status: r.status,
                  ms: Date.now() - started,
                  usage: body.usage,
                  error: body.error?.message?.slice(0, 120),
                  got: en.filter(Boolean).length,
                  sample: en.slice(0, 12),
                };
              } catch (e) {
                return { model, status: 0, ms: Date.now() - started, error: String(e).slice(0, 80) };
              }
            }),
          );
          return new Response(JSON.stringify({ es: titles.slice(0, 12), rows }, null, 1), {
            headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
          });
        }
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
