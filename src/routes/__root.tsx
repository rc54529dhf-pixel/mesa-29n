import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useLocation,
} from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";
// Self-hosted fonts: the two files every page needs are preloaded.
import geistFont from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url";
import geistMonoFont from "@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2?url";

const APP_NAME = "Mesa 29N";

/**
 * Sets the edition before first paint so a night-edition reader never sees a light flash.
 * A saved choice wins; otherwise the device setting decides.
 */
const EDITION_BOOT =
  'try{var e=localStorage.getItem("mesa-edition");if(e!=="day"&&e!=="night"){e=matchMedia("(prefers-color-scheme: dark)").matches?"night":"day"}document.documentElement.dataset.edition=e}catch(_){}';

/** Same host guard the share injector uses for og:image. */
function publicShareHost(hostHeader: string): string {
  const host = hostHeader.split(",")[0]?.trim().split(":")[0]?.toLowerCase() ?? "";
  if (!host || !/^[a-z0-9.-]+$/.test(host) || !host.includes(".")) return "";
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return "";
  if (
    host === "vercel.app" ||
    host.endsWith(".vercel.app") ||
    host === "vercel.com" ||
    host.endsWith(".vercel.com")
  ) {
    return "";
  }
  return host;
}

async function resolveShareHost(): Promise<string> {
  const fromEnv = publicShareHost(String(import.meta.env.VITE_PUBLIC_HOSTNAME ?? ""));
  if (fromEnv) return fromEnv;
  if (!import.meta.env.SSR) return "";
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const header = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
    return publicShareHost(header);
  } catch {
    return "";
  }
}

/**
 * Vercel Web Analytics: cookieless page counts, one per section address.
 * The path is passed in so a move between sections is counted as a page view.
 */
function DeskAnalytics() {
  const path = useLocation({ select: (location) => location.pathname });
  return <Analytics route={path} path={path} />;
}

export const Route = createRootRoute({
  head: async () => {
    const host = await resolveShareHost();
    const meta: { charSet?: string; name?: string; property?: string; content?: string; title?: string }[] = [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Live desk for Spain’s 29 November 2026 general election. Official rules and the last count, media polls, and models — each one labeled.",
      },
      { name: "theme-color", content: "#f7f6f2" },
    ];
    if (host) {
      const xBanner = `https://${host}/x-banner.jpg`;
      meta.push({ property: "x:game:image", content: xBanner });
    }
    return {
      meta,
      links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preload", as: "font", type: "font/woff2", href: geistFont, crossOrigin: "anonymous" },
      { rel: "preload", as: "font", type: "font/woff2", href: geistMonoFont, crossOrigin: "anonymous" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      ],
    };
  },
  notFoundComponent: () => (
    <main className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col items-start justify-center gap-4 px-5 md:px-8">
      <p className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">404</p>
      <h1 className="text-4xl leading-tight font-medium tracking-[-0.035em]">This page is not on the desk.</h1>
      <Link to="/{-$section}" params={{ section: undefined }} className="font-semibold underline decoration-gold underline-offset-4">
        Mesa 29N
      </Link>
    </main>
  ),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: EDITION_BOOT }} />
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <DeskAnalytics />
        <Scripts />
      </body>
    </html>
  ),
});
