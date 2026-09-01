import type { ReactNode } from "react";

export function UtilityDemo({
  icon,
  label,
  children,
  anomaly = false,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  anomaly?: boolean;
}) {
  return (
    <figure className="wb-guide-control-demo">
      <div
        aria-hidden="true"
        className={`wb-guide-control ${anomaly ? "wb-guide-control--anomaly" : ""}`}
      >
        {icon}
        <span>{label}</span>
      </div>
      <figcaption>{children}</figcaption>
    </figure>
  );
}
