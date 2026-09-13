"use client";

import type {
  ProfileCommandSnapshot,
  StoreItemPreview,
} from "@/src/lib/profile/profile-command-contract";
import { formatBalance } from "./profile-command-format";
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
          <span className={styles.storeArtwork} aria-hidden="true">
            {item.category.slice(0, 2).toLocaleUpperCase("pt-BR")}
          </span>
          <span>
            <small>{item.category}</small>
            <strong>{item.name}</strong>
          </span>
          <em>
            {item.price.currency === "command-reserve" ? "◆" : "◈"} {formatBalance(item.price.amount)}
          </em>
        </button>
      ))}
      <p className={styles.storeDisclaimer}>
        Vitrine local · nenhuma compra é persistida nesta etapa.
      </p>
    </div>
  );
}
