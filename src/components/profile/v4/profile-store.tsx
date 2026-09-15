"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CosmeticCatalogItem,
  CosmeticSet,
  CosmeticSlot,
  EconomyStorefrontSnapshot,
} from "@/src/lib/economy/economy-contract";
import { cosmeticPreviewSource } from "@/src/lib/economy/cosmetic-preview";
import { ProfileCosmeticImage } from "./profile-cosmetic-image";
import mobileStyles from "./profile-store-mobile-inspection.module.css";
import styles from "./profile-store.module.css";

const SLOT_LABELS: Readonly<Record<CosmeticSlot, string>> = {
  dice_attack: "Ataque",
  dice_defense: "Defesa",
  dice_neutral: "Neutro",
  territory_effect: "Território",
};

function previewItem(set: CosmeticSet) {
  return set.items.find((item) => cosmeticPreviewSource(item) !== null) ?? set.items[0] ?? null;
}

function itemArtwork(item: CosmeticCatalogItem | null) {
  return item ? cosmeticPreviewSource(item) : null;
}

function ownershipLabel(set: CosmeticSet) {
  const owned = set.items.filter((item) => item.owned).length;
  if (owned === set.items.length && set.items.length > 0) return "POSSUÍDO";
  if (owned > 0) return `${owned}/${set.items.length} POSSUÍDOS`;
  return set.status === "available" ? "CATÁLOGO" : "EM BREVE";
}

function InspectionContent({
  selectedSet,
  selectedItem,
  selectedArtwork,
  titleId,
  onSelectItem,
}: {
  selectedSet: CosmeticSet | null;
  selectedItem: CosmeticCatalogItem | null;
  selectedArtwork: string | null;
  titleId: string;
  onSelectItem: (itemId: string) => void;
}) {
  return (
    <>
      <div className={styles.inspectionVisual}>
        <ProfileCosmeticImage
          src={selectedArtwork}
          alt={selectedItem ? `Prévia de ${selectedItem.name}` : "Prévia cosmética"}
          width={560}
          height={560}
          fallbackLabel="PRÉVIA INDISPONÍVEL"
        />
      </div>
      <div className={styles.inspectionCopy}>
        <small>INSPEÇÃO // SEM MUTAÇÃO</small>
        <h2 id={titleId}>{selectedSet?.name ?? "Selecione uma coleção"}</h2>
        <p>{selectedSet?.description ?? "Nenhuma descrição de catálogo disponível."}</p>

        {selectedSet ? (
          <div className={styles.itemSelector} role="group" aria-label={`Itens de ${selectedSet.name}`}>
            {selectedSet.items.map((item) => (
              <button
                key={item.id}
                type="button"
                data-active={selectedItem?.id === item.id ? "true" : "false"}
                aria-pressed={selectedItem?.id === item.id}
                onClick={() => onSelectItem(item.id)}
              >
                <small>{SLOT_LABELS[item.slot]}</small>
                <strong>{item.name}</strong>
                <span>{item.owned ? (item.equipped ? "EQUIPADO" : "POSSUÍDO") : "NÃO ADQUIRIDO"}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className={styles.commerceBoundary}>
          <span>AQUISIÇÕES</span>
          <strong>EM PREPARAÇÃO</strong>
          <p>Preços e ordens de compra aparecerão aqui quando o ciclo comercial estiver ativo.</p>
        </div>
      </div>
    </>
  );
}

export function ProfileStore({ storefront }: { storefront: EconomyStorefrontSnapshot }) {
  const featured = useMemo(
    () => storefront.sets.find((set) => set.status === "available") ?? storefront.sets[0] ?? null,
    [storefront.sets],
  );
  const [selectedSetId, setSelectedSetId] = useState<string | null>(featured?.id ?? null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(featured ? previewItem(featured)?.id ?? null : null);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const inspectionReturnFocusRef = useRef<HTMLElement | null>(null);

  const selectedSet = storefront.sets.find((set) => set.id === selectedSetId) ?? featured;
  const selectedItem = selectedSet
    ? selectedSet.items.find((item) => item.id === selectedItemId) ?? previewItem(selectedSet)
    : null;
  const selectedArtwork = itemArtwork(selectedItem);

  const closeInspection = useCallback(() => {
    setInspectionOpen(false);
    const returnTarget = inspectionReturnFocusRef.current;
    if (returnTarget) {
      window.requestAnimationFrame(() => {
        if (returnTarget.isConnected) returnTarget.focus();
      });
    }
  }, []);

  useEffect(() => {
    if (!inspectionOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeInspection();
    };
    const isMobile = window.matchMedia("(max-width: 820px)").matches;
    const previousOverflow = document.body.style.overflow;

    window.addEventListener("keydown", onKeyDown);
    if (isMobile) {
      document.body.style.overflow = "hidden";
      window.requestAnimationFrame(() => mobileCloseRef.current?.focus());
    }

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (isMobile) document.body.style.overflow = previousOverflow;
    };
  }, [closeInspection, inspectionOpen]);

  function inspect(set: CosmeticSet) {
    if (document.activeElement instanceof HTMLElement) {
      inspectionReturnFocusRef.current = document.activeElement;
    }
    setSelectedSetId(set.id);
    setSelectedItemId(previewItem(set)?.id ?? null);
    setInspectionOpen(true);
  }

  return (
    <div className={styles.store} data-profile-v4-surface="store">
      <section className={styles.hero} aria-labelledby="store-title">
        <div className={styles.heroCopy}>
          <small>INTENDÊNCIA // CATÁLOGO COSMÉTICO</small>
          <h1 id="store-title">Remessas do Comando</h1>
          <p>
            Inspecione coleções, compare equipamentos e acompanhe as próximas remessas disponíveis para o comandante.
          </p>
          {featured ? (
            <button type="button" onClick={() => inspect(featured)}>
              INSPECIONAR DESTAQUE
            </button>
          ) : null}
        </div>
        <div className={styles.heroVisual}>
          <ProfileCosmeticImage
            src={featured ? itemArtwork(previewItem(featured)) : null}
            alt={featured ? `Destaque ${featured.name}` : "Destaque do catálogo"}
            width={520}
            height={520}
            priority
            fallbackLabel="SEM PRÉVIA"
          />
          <div>
            <small>DESTAQUE ATUAL</small>
            <strong>{featured?.name ?? "Nenhuma remessa disponível"}</strong>
          </div>
        </div>
      </section>

      <section className={styles.catalog} aria-labelledby="catalog-title">
        <header className={styles.sectionHeading}>
          <span>
            <small>CATÁLOGO SINCRONIZADO</small>
            <h2 id="catalog-title">Coleções</h2>
          </span>
          <strong>{storefront.sets.length.toString().padStart(2, "0")}</strong>
        </header>

        {storefront.sets.length > 0 ? (
          <div className={styles.catalogGrid}>
            {storefront.sets.map((set) => {
              const art = itemArtwork(previewItem(set));
              const active = selectedSet?.id === set.id;
              return (
                <article key={set.id} className={styles.productCard} data-active={active ? "true" : "false"}>
                  <button type="button" className={styles.productSelect} onClick={() => inspect(set)}>
                    <span className={styles.productVisual}>
                      <ProfileCosmeticImage
                        src={art}
                        alt={`Prévia de ${set.name}`}
                        width={300}
                        height={300}
                        fallbackClassName={styles.productFallback}
                        fallbackLabel="WB"
                      />
                    </span>
                    <span className={styles.productCopy}>
                      <small>{set.status === "retired" ? "ARQUIVADO" : set.status === "announced" ? "EM BREVE" : "CATÁLOGO"}</small>
                      <strong>{set.name}</strong>
                      <em>{ownershipLabel(set)}</em>
                    </span>
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyCatalog}>
            <strong>Nenhuma remessa disponível</strong>
            <span>A Intendência continua acessível enquanto o catálogo é restabelecido.</span>
          </div>
        )}
      </section>

      <section
        className={`${styles.inspection} ${mobileStyles.desktopInspection}`}
        aria-labelledby="inspection-title-desktop"
      >
        <InspectionContent
          selectedSet={selectedSet}
          selectedItem={selectedItem}
          selectedArtwork={selectedArtwork}
          titleId="inspection-title-desktop"
          onSelectItem={setSelectedItemId}
        />
      </section>

      {inspectionOpen ? (
        <>
          <button
            type="button"
            className={mobileStyles.mobileInspectionBackdrop}
            aria-label="Fechar inspeção"
            onClick={closeInspection}
          />
          <section
            className={mobileStyles.mobileInspection}
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspection-title-mobile"
          >
            <header className={mobileStyles.mobileInspectionHeader}>
              <span>
                <small>INSPEÇÃO TÁTICA</small>
                <strong>{selectedSet?.name ?? "Coleção"}</strong>
              </span>
              <button
                ref={mobileCloseRef}
                type="button"
                className={mobileStyles.mobileInspectionClose}
                aria-label="Fechar inspeção"
                onClick={closeInspection}
              >
                ×
              </button>
            </header>
            <div className={`${styles.inspection} ${mobileStyles.mobileInspectionBody}`}>
              <InspectionContent
                selectedSet={selectedSet}
                selectedItem={selectedItem}
                selectedArtwork={selectedArtwork}
                titleId="inspection-title-mobile"
                onSelectItem={setSelectedItemId}
              />
            </div>
          </section>
        </>
      ) : null}

      <section id="reforcar-tesouraria" className={styles.treasury} aria-labelledby="treasury-title">
        <span className={styles.treasuryCoin} aria-hidden="true">
          <Image src="/coin.svg" alt="" width={72} height={72} />
        </span>
        <div>
          <small>TESOURARIA // CRÉDITOS DE CAMPANHA</small>
          <h2 id="treasury-title">Reforçar Tesouraria</h2>
          <p>Novas formas de reforçar seus Créditos de Campanha serão liberadas em uma próxima atualização.</p>
        </div>
        <strong>EM BREVE</strong>
      </section>
    </div>
  );
}