"use client";

import Link from "next/link";
import type {
  ProfileCommandSnapshot,
  StoreItemPreview,
} from "@/src/lib/profile/profile-command-contract";
import styles from "./profile-command-hub.module.css";

export function ProfileQuartermasterStation({
  snapshot,
  selectedSlug,
  onSelect,
}: {
  snapshot: ProfileCommandSnapshot;
  selectedSlug: string | null;
  onSelect: (item: StoreItemPreview) => void;
}) {
  const items = snapshot.storefront.data.featuredItems;

  if (snapshot.storefront.availability === "unavailable") {
    return (
      <div className={styles.unavailableState}>
        <span>INTENDÊNCIA INDISPONÍVEL</span>
        <small>{snapshot.storefront.unavailableReason}</small>
      </div>
    );
  }

  if (snapshot.storefront.availability === "empty" || items.length === 0) {
    return (
      <div className={styles.emptyState}>
        <strong>Nenhuma remessa ativa</strong>
        <span>A Intendência permanece operacional sem produtos em destaque.</span>
      </div>
    );
  }

  return (
    <div className={styles.storeContent}>
      {items.slice(0, 3).map((item) => (
        <button
          key={item.slug}
          type="button"
          className={styles.storeItem}
          data-selected={selectedSlug === item.slug ? "true" : "false"}
          aria-pressed={selectedSlug === item.slug}
          onClick={() => onSelect(item)}
        >
          <span className={styles.storeArtwork} aria-hidden="true">D6</span>
          <span>
            <small>conjunto de dados · {item.itemCount} itens</small>
            <strong>{item.name}</strong>
          </span>
          <em>{item.status === "announced" ? "EM BREVE" : "DISPONÍVEL"}</em>
        </button>
      ))}
      <p className={styles.storeDisclaimer}>
        Catálogo real · nenhuma compra habilitada nesta etapa. {" "}
        <Link href="/profile/store">Abrir arsenal</Link>
      </p>
    </div>
  );
}
