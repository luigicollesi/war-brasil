"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function ProfileCosmeticImage({
  src,
  alt,
  width,
  height,
  priority = false,
  className,
  fallbackClassName,
  fallbackLabel,
}: {
  src: string | null;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
  fallbackClassName?: string;
  fallbackLabel: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <span
        className={fallbackClassName}
        role="img"
        aria-label={`Prévia indisponível para ${alt}`}
      >
        {fallbackLabel}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      unoptimized
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
