"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

type ParticipationResponse = {
  participation?: {
    target?: string;
  } | null;
};

const PUBLIC_PATHS = new Set(["/terms", "/privacy"]);

export function ActiveParticipationRuntime({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [checkedPath, setCheckedPath] = useState<string | null>(null);

  const shouldCheck =
    pathname !== "/" &&
    !PUBLIC_PATHS.has(pathname) &&
    !pathname.startsWith("/api/");

  useEffect(() => {
    if (!shouldCheck) return;

    let cancelled = false;

    void fetch("/api/participation", {
      method: "POST",
      cache: "no-store",
    })
      .then(async (response) => {
        if (cancelled) return;

        if (response.status === 401) {
          setCheckedPath(pathname);
          return;
        }

        const body = (await response.json().catch(() => null)) as
          | ParticipationResponse
          | null;
        if (!response.ok) {
          setCheckedPath(pathname);
          return;
        }

        const target = body?.participation?.target;
        if (typeof target === "string" && target !== pathname) {
          router.replace(target);
          return;
        }

        if (
          !target &&
          (pathname.startsWith("/lobby/") || pathname.startsWith("/game/"))
        ) {
          router.replace(
            pathname.startsWith("/lobby/") ? "/matchmaking" : "/home",
          );
          return;
        }

        setCheckedPath(pathname);
      })
      .catch(() => {
        if (!cancelled) setCheckedPath(pathname);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router, shouldCheck]);

  if (shouldCheck && checkedPath !== pathname) {
    return (
      <div
        className="min-h-dvh bg-black"
        aria-live="polite"
        aria-busy="true"
      />
    );
  }

  return <>{children}</>;
}
