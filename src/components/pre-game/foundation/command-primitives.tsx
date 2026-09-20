import type { HTMLAttributes, ReactNode } from "react";
import styles from "./command-foundation.module.css";

type CommandTone = "neutral" | "authority" | "conflict" | "positive";

export function CommandLabel({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: CommandTone;
  className?: string;
}) {
  return (
    <span
      className={[styles.commandLabel, className].filter(Boolean).join(" ")}
      data-tone={tone}
    >
      {children}
    </span>
  );
}

export function CommandDivider({ className }: { className?: string }) {
  return (
    <span
      className={[styles.commandDivider, className].filter(Boolean).join(" ")}
      aria-hidden="true"
    />
  );
}

export function CommandStatus({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: CommandTone;
  className?: string;
}) {
  return (
    <span
      className={[styles.commandStatus, className].filter(Boolean).join(" ")}
      data-tone={tone}
      role="status"
    >
      <i aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

export function CommandPanel({
  title,
  eyebrow,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <section
      {...props}
      className={[styles.commandPanel, className].filter(Boolean).join(" ")}
    >
      {eyebrow ? <span className={styles.panelEyebrow}>{eyebrow}</span> : null}
      {title ? <h2 className={styles.panelTitle}>{title}</h2> : null}
      {children}
    </section>
  );
}

export function CommandInsignia({
  monogram,
  label,
  status,
  tone = "authority",
  className,
}: {
  monogram: string;
  label: string;
  status?: string;
  tone?: CommandTone;
  className?: string;
}) {
  const accessibleLabel = status ? `${label}. ${status}` : label;
  return (
    <div
      className={[styles.insignia, className].filter(Boolean).join(" ")}
      data-tone={tone}
      role="img"
      aria-label={accessibleLabel}
    >
      <span className={styles.insigniaMedallion} aria-hidden="true">
        <i />
        <strong>{monogram.slice(0, 3).toUpperCase()}</strong>
      </span>
      <span className={styles.insigniaCopy}>
        <strong>{label}</strong>
        {status ? <small>{status}</small> : null}
      </span>
    </div>
  );
}
