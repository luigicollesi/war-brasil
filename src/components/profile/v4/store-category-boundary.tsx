"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./store-category-boundary.module.css";

export function StoreCategoryBoundary({
  variant,
  eyebrow,
  title,
  description,
  action,
}: {
  variant: "loading" | "error";
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <main className={styles.page} data-store-category-boundary={variant}>
      <div className={styles.atmosphere} aria-hidden="true" />
      <section className={styles.state} aria-live={variant === "loading" ? "polite" : undefined}>
        <Link href="/profile/store" className={styles.backLink}>← INTENDÊNCIA</Link>
        <span className={styles.code}>{eyebrow}</span>
        <div className={styles.signal} aria-hidden="true"><i /><i /><i /></div>
        <h1>{title}</h1>
        <p>{description}</p>
        {action ? <div className={styles.actions}>{action}</div> : null}
      </section>
    </main>
  );
}
