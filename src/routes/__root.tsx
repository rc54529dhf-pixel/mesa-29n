import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "Mesa 29N";

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
      { name: "theme-color", content: "#e8edf3" },
    ];
    if (host) {
      const xBanner = `https://${host}/x-banner.jpg`;
      meta.push({ property: "x:game:image", content: xBanner });
    }
    return {
      meta,
      links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400;0,600;0,700;1,400&family=Outfit:wght@500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      ],
    };
  },
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
