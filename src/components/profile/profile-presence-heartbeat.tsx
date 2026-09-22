"use client";

import { useEffect } from "react";
import { useSession } from "@/src/lib/client/auth-client";

const HEARTBEAT_INTERVAL_MS = 60_000;

export function ProfilePresenceHeartbeat() {
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (isPending || !session?.user) return undefined;

    let stopped = false;
    const heartbeat = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      await fetch("/api/profile/presence/heartbeat", {
        method: "POST",
        cache: "no-store",
      }).catch(() => undefined);
    };

    void heartbeat();
    const interval = window.setInterval(() => {
      void heartbeat();
    }, HEARTBEAT_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void heartbeat();
    };
    const onFocus = () => void heartbeat();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [isPending, session?.user]);

  return null;
}
