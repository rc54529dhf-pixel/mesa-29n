import { createFileRoute, notFound } from "@tanstack/react-router";
import { Mesa } from "@/components/mesa";
import { SECTION_TITLES, isSection } from "@/lib/sections";

/**
 * One route for every section: "/" is Now, "/polls", "/blocs", "/count",
 * "/vote" and "/sources" are the rest. The desk stays mounted while the
 * section changes, so language, filters and the clock carry over.
 */
export const Route = createFileRoute("/{-$section}")({
  beforeLoad: ({ params }) => {
    if (params.section !== undefined && !isSection(params.section)) throw notFound();
  },
  // The server's render time travels with the HTML, so the first client render
  // matches it exactly even when the page comes from the CDN cache.
  loader: () => ({ renderedAt: Date.now() }),
  // The CDN keeps the page for 30 seconds and may serve it for 30 more while it
  // refreshes in the background. Browsers always revalidate.
  headers: () => ({
    "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=30",
  }),
  head: ({ params }) => ({
    meta:
      params.section !== undefined && isSection(params.section)
        ? [{ title: `${SECTION_TITLES[params.section]} · Mesa 29N` }]
        : [],
  }),
  component: Home,
});

function Home() {
  const { section } = Route.useParams();
  const { renderedAt } = Route.useLoaderData();
  return (
    <Mesa
      tab={section !== undefined && isSection(section) ? section : "now"}
      renderedAt={renderedAt}
    />
  );
}
