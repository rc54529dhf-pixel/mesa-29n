import { useEffect, useState } from "react";
import { previewPathPrefix } from "@/lib/preview-path-prefix";
import type { LivePayload } from "./feeds";

export type LiveFeed = {
  /** "loading" until the first answer; "failed" only when there is nothing to show. */
  status: "loading" | "ready" | "failed";
  data: LivePayload | null;
};

const REFRESH_MS = 120_000;

/**
 * Loads the headline list while `active`, and again every two minutes while the
 * page is on screen. A failed refresh keeps the headlines already shown.
 */
export function useLiveFeed(active: boolean): LiveFeed {
  const [feed, setFeed] = useState<LiveFeed>({ status: "loading", data: null });

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const controller = new AbortController();
    const prefix = previewPathPrefix(window.location.hostname, window.location.pathname) ?? "";

    const load = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch(`${prefix}/api/live`, {
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`live feed answered ${response.status}`);
        const data = (await response.json()) as LivePayload;
        if (!Array.isArray(data.items) || !Array.isArray(data.sources)) {
          throw new Error("live feed answered in an unexpected shape");
        }
        if (!stopped) setFeed({ status: "ready", data });
      } catch {
        if (!stopped)
          setFeed((current) => (current.data ? current : { status: "failed", data: null }));
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active]);

  return feed;
}
