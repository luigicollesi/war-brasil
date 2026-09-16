"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useShowcaseScene } from "@/src/components/pre-game/foundation";
import {
  ShowcasePurchaseError,
  purchaseShowcaseOffer,
} from "@/src/lib/client/store-showcase/purchase-showcase-offer";
import type {
  StoreShowcaseItem,
  StoreShowcaseOffer,
  StoreShowcaseView,
} from "@/src/lib/economy/store-showcase";
import { ProfileCosmeticImage } from "../profile-cosmetic-image";
import { DiceShowcaseModel } from "./dice-showcase-model";
import { ShowcaseObjectController } from "./showcase-object-controller";
import { TerritoryShowcaseModel } from "./territory-showcase-model";
import styles from "./store-showcase.module.css";

const INTEGER_FORMAT = new Intl.NumberFormat("pt-BR");

type PurchaseMessage = Readonly<{
  kind: "success" | "error";
  text: string;
}>;

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

function promotionLabel(discountBps: number) {
  return `${INTEGER_FORMAT.format(discountBps / 100)}% OFF`;
}

function purchaseErrorMessage(error: ShowcasePurchaseError) {
  if (error.code === "ECONOMY_PRICE_CHANGED") {
    return error.currentPrice === null
      ? "O preço mudou. Confira o valor atualizado antes de tentar novamente."
      : `O preço mudou para ${priceLabel(error.currentPrice)}. Confirme o novo valor.`;
  }
  if (error.code === "ECONOMY_INSUFFICIENT_BALANCE") {
    return "Créditos insuficientes para concluir esta compra.";
  }
  if (error.code === "ECONOMY_OFFER_ALREADY_OWNED") {
    return "Este conteúdo já pertence ao seu Arsenal.";
  }
  return error.retryable
    ? "Não foi possível confirmar a compra. Tente novamente para consultar a mesma operação com segurança."
    : error.message;
}

function shouldRefreshAfterError(error: ShowcasePurchaseError) {
  return (
    error.code === "ECONOMY_PRICE_CHANGED" ||
    error.code === "ECONOMY_OFFER_ALREADY_OWNED" ||
    error.code === "ECONOMY_OFFER_UNAVAILABLE"
  );
}

export function StoreShowcase({ showcase }: { showcase: StoreShowcaseView }) {
  const router = useRouter();
  const [selectedItemId, setSelectedItemId] = useState(showcase.selectedItemId);
  const [failedBackgroundRef, setFailedBackgroundRef] = useState<string | null>(null);
  const [pendingOfferId, setPendingOfferId] = useState<string | null>(null);
  const [purchaseMessage, setPurchaseMessage] = useState<PurchaseMessage | null>(null);

  const selectedIndexFromState = showcase.items.findIndex((item) => item.id === selectedItemId);
  const selectedIndexFromProjection = showcase.items.findIndex(
    (item) => item.id === showcase.selectedItemId,
  );
  const selectedIndex =
    selectedIndexFromState >= 0
      ? selectedIndexFromState
      : Math.max(0, selectedIndexFromProjection);
  const selectedItem = showcase.items[selectedIndex] ?? showcase.items[0];
  const selectedOffer = selectedItem?.singleOffer ?? null;
  const itemCount = showcase.items.length;
  const backgroundFailed =
    showcase.backgroundRef !== null && failedBackgroundRef === showcase.backgroundRef;
  const collectionBackgroundVisible =
    showcase.mode === "collection" && Boolean(showcase.backgroundRef) && !backgroundFailed;

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
              slot={selectedItem.slot}
            />
          ) : selectedItem?.type === "territory" ? (
            <TerritoryShowcaseModel
              cosmeticId={selectedItem.id}
              assetRef={selectedItem.assetRef}
              effectKey={selectedItem.effectKey}
            />
          ) : null}
        </ShowcaseObjectController>
      ),
    }),
    [selectedItem, showcase.id, showcase.mode],
  );
  useShowcaseScene(showcaseScene, Boolean(selectedItem));

  function moveSelection(direction: -1 | 1) {
    if (itemCount <= 1) return;
    const nextIndex = (selectedIndex + direction + itemCount) % itemCount;
    const nextItem = showcase.items[nextIndex];
    if (nextItem) setSelectedItemId(nextItem.id);
    setPurchaseMessage(null);
  }

  async function handlePurchase(offer: StoreShowcaseOffer | null) {
    if (!offer?.purchasable || pendingOfferId !== null) return;

    setPendingOfferId(offer.id);
    setPurchaseMessage(null);
    try {
      await purchaseShowcaseOffer({
        offerId: offer.id,
        expectedPrice: offer.price,
      });
      setPurchaseMessage({
        kind: "success",
        text: "Compra confirmada. Arsenal e créditos atualizados pelo Comando.",
      });
      router.refresh();
    } catch (error) {
      if (error instanceof ShowcasePurchaseError) {
        setPurchaseMessage({ kind: "error", text: purchaseErrorMessage(error) });
        if (shouldRefreshAfterError(error)) router.refresh();
      } else {
        setPurchaseMessage({
          kind: "error",
          text: "A compra não pôde ser confirmada agora.",
        });
      }
    } finally {
      setPendingOfferId(null);
    }
  }

  if (!selectedItem) return null;

  const itemPurchasePending = pendingOfferId === selectedOffer?.id;
  const bundlePurchasePending = pendingOfferId === showcase.bundleOffer?.id;
  const itemPurchaseDisabled =
    selectedItem.owned || !selectedOffer?.purchasable || pendingOfferId !== null;
  const bundlePurchaseDisabled =
    showcase.fullyOwned || !showcase.bundleOffer?.purchasable || pendingOfferId !== null;

  return (
    <main
      className={styles.root}
      style={{ background: "transparent", pointerEvents: "none" }}
      data-showcase-mode={showcase.mode}
      data-collection-background={collectionBackgroundVisible ? "ready" : "fallback"}
      aria-label="Expositor da Intendência"
    >
      {collectionBackgroundVisible ? (
        <div className={styles.collectionBackdrop} aria-hidden="true">
          <Image
            src={showcase.backgroundRef as string}
            alt=""
            fill
            priority
            unoptimized
            sizes="100vw"
            onError={() => setFailedBackgroundRef(showcase.backgroundRef)}
          />
          <span className={styles.collectionBackdropScrim} />
        </div>
      ) : null}

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
          {showcase.mode === "collection" && showcase.logoRef ? (
            <ProfileCosmeticImage
              src={showcase.logoRef}
              alt={`Logo da coleção ${showcase.title}`}
              width={180}
              height={52}
              priority
              className={styles.collectionLogo}
              fallbackClassName={styles.collectionLogoFallback}
              fallbackLabel="COLEÇÃO"
            />
          ) : null}
          <small>
            {showcase.mode === "collection"
              ? "COLEÇÃO // EXPOSIÇÃO ESPECIAL"
              : "INSPEÇÃO // ARSENAL"}
          </small>
          <strong>{showcase.title}</strong>
          {showcase.mode === "collection" && showcase.promotionDiscountBps > 0 ? (
            <span
              className={styles.promotionBadge}
              aria-label={`${showcase.promotionDiscountBps / 100}% de desconto na coleção`}
            >
              {promotionLabel(showcase.promotionDiscountBps)}
            </span>
          ) : null}
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
          <span className={styles.stageMarker}>
            {selectedItem.type === "dice"
              ? "EXPOSITOR 3D // GEOMETRIA CANÔNICA"
              : "EXPOSITOR 3D // TERRITÓRIO CANÔNICO"}
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
            <button
              type="button"
              disabled={itemPurchaseDisabled}
              onClick={() => void handlePurchase(selectedOffer)}
            >
              {selectedItem.owned
                ? "POSSUÍDO"
                : itemPurchasePending
                  ? "PROCESSANDO..."
                  : selectedOffer?.purchasable
                    ? "COMPRAR ITEM"
                    : "INDISPONÍVEL"}
            </button>
          </div>
        </aside>
      </section>

      {purchaseMessage ? (
        <div
          className={styles.purchaseMessage}
          data-kind={purchaseMessage.kind}
          role="status"
          aria-live="polite"
          style={{ pointerEvents: "auto" }}
        >
          {purchaseMessage.text}
        </div>
      ) : null}

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
              onClick={() => {
                setSelectedItemId(item.id);
                setPurchaseMessage(null);
              }}
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
          <button
            type="button"
            disabled={bundlePurchaseDisabled}
            onClick={() => void handlePurchase(showcase.bundleOffer)}
          >
            {showcase.fullyOwned
              ? "COMPLETO"
              : bundlePurchasePending
                ? "PROCESSANDO..."
                : showcase.partiallyOwned
                  ? "COMPLETAR"
                  : showcase.bundleOffer?.purchasable
                    ? "COMPRAR TUDO"
                    : "INDISPONÍVEL"}
          </button>
        </div>
      </footer>
    </main>
  );
}
