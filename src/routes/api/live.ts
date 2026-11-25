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
        // TEMPORARY PROBE (preview branch only, removed before release): which cheap
        // models does this team's AI Gateway tier allow?
        if (new URL(request.url).searchParams.get("view") === "models" && aiToken) {
          const auth = { authorization: `Bearer ${aiToken}`, "content-type": "application/json" };
          const list = (await (await fetch("https://ai-gateway.vercel.sh/v1/models", { headers: auth })).json()) as {
            data?: { id: string; type?: string; pricing?: { input?: string; output?: string } }[];
          };
          const family =
            /(gemini.*flash|gpt-.*(nano|mini)|haiku|mistral.*(small|medium)|llama|deepseek|grok.*fast|qwen|nova-(micro|lite)|gemma|glm|kimi|minimax)/i;
          const cheap = (list.data ?? [])
            .filter((m) => (m.type ?? "language") === "language" && family.test(m.id))
            .filter((m) => Number(m.pricing?.input ?? "1") <= 0.0000006)
            .slice(0, 45);
          const rows = await Promise.all(
            cheap.map(async (m) => {
              try {
                const r = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
                  method: "POST",
                  headers: auth,
                  body: JSON.stringify({ model: m.id, max_tokens: 8, messages: [{ role: "user", content: "Reply with OK" }] }),
                  signal: AbortSignal.timeout(12000),
                });
                let why = "";
                if (!r.ok) {
                  const b = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
                  why = (b.error?.message ?? "").slice(0, 40);
                }
                return `${r.status} ${m.id} in=${m.pricing?.input} out=${m.pricing?.output} ${why}`;
              } catch (e) {
                return `ERR ${m.id} ${String(e).slice(0, 40)}`;
              }
            }),
          );
          return new Response(JSON.stringify({ total: list.data?.length ?? 0, tried: rows.length, rows: rows.sort() }, null, 1), {
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
