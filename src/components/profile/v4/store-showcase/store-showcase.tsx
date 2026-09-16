"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useShowcaseScene } from "@/src/components/pre-game/foundation";
import type {
  StoreShowcaseItem,
  StoreShowcaseView,
} from "@/src/lib/economy/store-showcase";
import { ProfileCosmeticImage } from "../profile-cosmetic-image";
import { DiceShowcaseModel } from "./dice-showcase-model";
import { ShowcaseObjectController } from "./showcase-object-controller";
import styles from "./store-showcase.module.css";

const INTEGER_FORMAT = new Intl.NumberFormat("pt-BR");

type DiceShowcaseSlot = "dice_attack" | "dice_defense" | "dice_neutral";

function itemRoleLabel(item: StoreShowcaseItem) {
  switch (item.slot) {
    case "dice_attack":
      return "DADO // ATAQUE";
    case "dice_defense":
      return "DADO // DEFESA";
    case "dice_neutral":
      return "DADO // NEUTRO";
    case "territory_skin":
      return "TERRITÓRIO // ACABAMENTO";
  }
}

function ownershipLabel(item: StoreShowcaseItem) {
  if (item.equipped) return "EQUIPADO";
  if (item.owned) return "POSSUÍDO";
  return "NÃO ADQUIRIDO";
}

function priceLabel(price: number) {
  return `${INTEGER_FORMAT.format(price)} CR`;
}

function previewSource(item: StoreShowcaseItem) {
  return item.previewRef ?? item.assetRef;
}

export function StoreShowcase({ showcase }: { showcase: StoreShowcaseView }) {
  const initialIndex = Math.max(
    0,
    showcase.items.findIndex((item) => item.id === showcase.selectedItemId),
  );
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const selectedItem = showcase.items[selectedIndex] ?? showcase.items[0];
  const selectedOffer = selectedItem?.singleOffer ?? null;
  const itemCount = showcase.items.length;

  const collectionProgress = useMemo(
    () => `${showcase.ownedCount}/${showcase.totalCount}`,
    [showcase.ownedCount, showcase.totalCount],
  );

  const showcaseScene = useMemo(
    () => ({
      key: selectedItem?.id ?? showcase.id,
      mode: showcase.mode,
      render: ({ reducedMotion }: { reducedMotion: boolean }) => (
        <ShowcaseObjectController reducedMotion={reducedMotion}>
          {selectedItem?.type === "dice" ? (
            <DiceShowcaseModel
              assetRef={selectedItem.assetRef}
              slot={selectedItem.slot as DiceShowcaseSlot}
            />
          ) : (
            <group name="StoreShowcaseModelSlot" />
          )}
        </ShowcaseObjectController>
      ),
    }),
    [
      selectedItem?.assetRef,
      selectedItem?.id,
      selectedItem?.slot,
      selectedItem?.type,
      showcase.id,
      showcase.mode,
    ],
  );
  useShowcaseScene(showcaseScene, Boolean(selectedItem));

  function moveSelection(direction: -1 | 1) {
    if (itemCount <= 1) return;
    setSelectedIndex((current) => (current + direction + itemCount) % itemCount);
  }

  if (!selectedItem) return null;

  return (
    <main
      className={styles.root}
      style={{ background: "transparent", pointerEvents: "none" }}
      data-showcase-mode={showcase.mode}
      aria-label="Expositor da Intendência"
    >
      <header
        className={styles.header}
        style={{ pointerEvents: "auto" }}
        data-showcase-zone="header"
      >
        <Link className={styles.backLink} href="/profile/store">
          <span aria-hidden="true">←</span>
          <span>INTENDÊNCIA</span>
        </Link>

        <div className={styles.headerIdentity}>
          <small>
            {showcase.mode === "collection"
              ? "COLEÇÃO // EXPOSIÇÃO ESPECIAL"
              : "INSPEÇÃO // ARSENAL"}
          </small>
          <strong>{showcase.title}</strong>
        </div>

        <div className={styles.wallet} aria-label={`${showcase.wallet.balance} Créditos de Campanha`}>
          <Image src="/coin.svg" width={22} height={22} alt="" aria-hidden="true" />
          <strong>{INTEGER_FORMAT.format(showcase.wallet.balance)}</strong>
          <span>CR</span>
        </div>
      </header>

      <section className={styles.stage} data-showcase-zone="stage" aria-live="polite">
        <button
          type="button"
          className={`${styles.stageArrow} ${styles.stageArrowPrevious}`}
          style={{ pointerEvents: "auto" }}
          aria-label="Exibir item anterior"
          disabled={itemCount <= 1}
          onClick={() => moveSelection(-1)}
        >
          ‹
        </button>

        <div className={styles.stageObject} data-showcase-object-type={selectedItem.type}>
          {selectedItem.type === "territory" ? (
            <div className={styles.previewFallback}>
              <ProfileCosmeticImage
                src={previewSource(selectedItem)}
                alt={`Prévia de ${selectedItem.name}`}
                width={680}
                height={680}
                fallbackLabel="TERRITÓRIO"
              />
            </div>
          ) : null}
          <span className={styles.stageMarker}>
            {selectedItem.type === "dice"
              ? "EXPOSITOR 3D // GEOMETRIA CANÔNICA"
              : "EXPOSITOR 3D // TERRITÓRIO EM PREPARAÇÃO"}
          </span>
        </div>

        <button
          type="button"
          className={`${styles.stageArrow} ${styles.stageArrowNext}`}
          style={{ pointerEvents: "auto" }}
          aria-label="Exibir próximo item"
          disabled={itemCount <= 1}
          onClick={() => moveSelection(1)}
        >
          ›
        </button>

        <aside
          className={styles.itemHud}
          style={{ pointerEvents: "auto" }}
          aria-label="Item em exposição"
        >
          <small>{itemRoleLabel(selectedItem)}</small>
          <h1>{selectedItem.name}</h1>
          <span className={styles.ownership}>{ownershipLabel(selectedItem)}</span>
          <p className={styles.description}>
            {selectedItem.description ?? showcase.description ?? "Cosmético do Arsenal do Comando."}
          </p>

          <div className={styles.itemCommerce}>
            <span>ITEM ATUAL</span>
            <strong>{selectedOffer ? priceLabel(selectedOffer.price) : "SEM OFERTA"}</strong>
            <button type="button" disabled>
              {selectedItem.owned ? "POSSUÍDO" : "COMPRAR ITEM"}
            </button>
          </div>
        </aside>
      </section>

      <footer
        className={styles.dock}
        style={{ pointerEvents: "auto" }}
        data-showcase-zone="dock"
      >
        <div className={styles.itemStrip} aria-label="Itens da exposição">
          {showcase.items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={index === selectedIndex}
              data-active={index === selectedIndex ? "true" : "false"}
              onClick={() => setSelectedIndex(index)}
            >
              <small>{itemRoleLabel(item)}</small>
              <strong>{item.name}</strong>
              <span>{ownershipLabel(item)}</span>
            </button>
          ))}
        </div>

        <div className={styles.bundleAction}>
          <span>
            <small>
              {showcase.mode === "collection" ? "COLEÇÃO" : "CONJUNTO"} {"//"} {collectionProgress}
            </small>
            <strong>
              {showcase.bundleOffer
                ? priceLabel(showcase.bundleOffer.price)
                : showcase.fullyOwned
                  ? "COMPLETO"
                  : "SEM OFERTA"}
            </strong>
          </span>
          <button type="button" disabled={!showcase.bundleOffer?.purchasable}>
            {showcase.fullyOwned
              ? "COMPLETO"
              : showcase.partiallyOwned
                ? "COMPLETAR"
                : "COMPRAR TUDO"}
          </button>
        </div>
      </footer>
    </main>
  );
}