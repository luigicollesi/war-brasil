"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useCommandSceneState,
  useShowcaseScene,
} from "@/src/components/pre-game/foundation";
import {
  ShowcasePurchaseError,
  purchaseShowcaseOffer,
} from "@/src/lib/client/store-showcase/purchase-showcase-offer";
import {
  SHOWCASE_ITEM_TRANSITION_PHASE_MS,
  type ShowcaseTransitionPhase,
} from "@/src/lib/client/store-showcase/showcase-motion";
import type {
  StoreShowcaseItem,
  StoreShowcaseOffer,
  StoreShowcaseView,
} from "@/src/lib/economy/store-showcase";
import { ProfileCosmeticImage } from "../profile-cosmetic-image";
import { DiceShowcaseModel } from "./dice-showcase-model";
import { ShowcaseModelErrorBoundary } from "./showcase-model-error-boundary";
import { ShowcaseObjectController } from "./showcase-object-controller";
import { TerritoryShowcaseFallback } from "./territory-showcase-fallback";
import { TerritoryShowcaseModel } from "./territory-showcase-model";
import styles from "./store-showcase.module.css";

const INTEGER_FORMAT = new Intl.NumberFormat("pt-BR");
const SEMANTIC_MIRROR_STYLE = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

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

function previewSource(item: StoreShowcaseItem) {
  return item.previewRef ?? item.assetRef;
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
  const sceneState = useCommandSceneState();
  const [selectedItemId, setSelectedItemId] = useState(showcase.selectedItemId);
  const [failedTerritoryItemId, setFailedTerritoryItemId] = useState<string | null>(null);
  const [pendingOfferId, setPendingOfferId] = useState<string | null>(null);
  const [purchaseMessage, setPurchaseMessage] = useState<PurchaseMessage | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState<ShowcaseTransitionPhase>("idle");
  const [transitionDirection, setTransitionDirection] = useState<-1 | 1>(1);
  const transitionTimers = useRef<number[]>([]);
  const selectedStripItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(media.matches);
    syncPreference();
    media.addEventListener?.("change", syncPreference);
    return () => media.removeEventListener?.("change", syncPreference);
  }, []);

  useEffect(
    () => () => {
      for (const timer of transitionTimers.current) window.clearTimeout(timer);
    },
    [],
  );

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
  const sceneFallback = sceneState === "fallback";
  const territoryGeometryFallback =
    selectedItem?.type === "territory" && selectedItem.id === failedTerritoryItemId;

  useEffect(() => {
    selectedStripItemRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [prefersReducedMotion, selectedIndex]);

  const collectionProgress = useMemo(
    () => `${showcase.ownedCount}/${showcase.totalCount}`,
    [showcase.ownedCount, showcase.totalCount],
  );

  const showcaseScene = useMemo(
    () => ({
      key: selectedItem?.id ?? showcase.id,
      mode: showcase.mode,
      render: ({ reducedMotion }: { reducedMotion: boolean }) => (
        <ShowcaseObjectController
          reducedMotion={reducedMotion}
          transitionPhase={transitionPhase}
          transitionDirection={transitionDirection}
        >
          {selectedItem?.type === "dice" ? (
            <DiceShowcaseModel
              assetRef={selectedItem.assetRef}
              slot={selectedItem.slot}
            />
          ) : selectedItem?.type === "territory" &&
            selectedItem.id !== failedTerritoryItemId ? (
            <ShowcaseModelErrorBoundary
              key={selectedItem.id}
              onError={() => setFailedTerritoryItemId(selectedItem.id)}
            >
              <TerritoryShowcaseModel
                cosmeticId={selectedItem.id}
                assetRef={selectedItem.assetRef}
                effectKey={selectedItem.effectKey}
              />
            </ShowcaseModelErrorBoundary>
          ) : null}
        </ShowcaseObjectController>
      ),
    }),
    [
      failedTerritoryItemId,
      selectedItem,
      showcase.id,
      showcase.mode,
      transitionDirection,
      transitionPhase,
    ],
  );
  useShowcaseScene(showcaseScene, Boolean(selectedItem));

  function clearTransitionTimers() {
    for (const timer of transitionTimers.current) window.clearTimeout(timer);
    transitionTimers.current = [];
  }

  function requestSelection(targetItemId: string, direction: -1 | 1) {
    if (targetItemId === selectedItem?.id || transitionPhase !== "idle") return;
    setPurchaseMessage(null);

    if (prefersReducedMotion) {
      setSelectedItemId(targetItemId);
      return;
    }

    clearTransitionTimers();
    setTransitionDirection(direction);
    setTransitionPhase("exit");

    const swapTimer = window.setTimeout(() => {
      setSelectedItemId(targetItemId);
      setTransitionPhase("enter");

      const settleTimer = window.setTimeout(() => {
        setTransitionPhase("idle");
        transitionTimers.current = [];
      }, SHOWCASE_ITEM_TRANSITION_PHASE_MS);
      transitionTimers.current = [settleTimer];
    }, SHOWCASE_ITEM_TRANSITION_PHASE_MS);

    transitionTimers.current = [swapTimer];
  }

  function moveSelection(direction: -1 | 1) {
    if (itemCount <= 1 || transitionPhase !== "idle") return;
    const nextIndex = (selectedIndex + direction + itemCount) % itemCount;
    const nextItem = showcase.items[nextIndex];
    if (nextItem) requestSelection(nextItem.id, direction);
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
  const showcaseBackground =
    showcase.mode === "collection"
      ? "radial-gradient(ellipse 24% 31% at 38% 47%, rgb(255 229 157 / 18%) 0%, transparent 72%), radial-gradient(ellipse 39% 48% at 38% 47%, rgb(210 174 87 / 25%) 0%, rgb(100 151 119 / 14%) 38%, rgb(31 67 48 / 7%) 58%, transparent 80%)"
      : "transparent";

  return (
    <main
      className={styles.root}
      style={{ background: showcaseBackground, pointerEvents: "none" }}
      data-showcase-mode={showcase.mode}
      data-transition-phase={transitionPhase}
      aria-label="Expositor da Intendência"
    >
      <section style={SEMANTIC_MIRROR_STYLE} aria-live="polite">
        <h2>{selectedItem.name}</h2>
        <p>
          Item {selectedIndex + 1} de {itemCount}. {itemRoleLabel(selectedItem)}.
        </p>
        <p>{ownershipLabel(selectedItem)}.</p>
        {selectedOffer ? (
          <>
            {selectedOffer.basePrice !== selectedOffer.price ? (
              <p>Preço original: {priceLabel(selectedOffer.basePrice)}.</p>
            ) : null}
            <p>Preço atual: {priceLabel(selectedOffer.price)}.</p>
          </>
        ) : (
          <p>Sem oferta individual ativa.</p>
        )}
        {showcase.promotionDiscountBps > 0 ? (
          <p>Promoção da coleção: {promotionLabel(showcase.promotionDiscountBps)}.</p>
        ) : null}
      </section>

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
          disabled={itemCount <= 1 || transitionPhase !== "idle"}
          onClick={() => moveSelection(-1)}
        >
          ‹
        </button>

        <div className={styles.stageObject} data-showcase-object-type={selectedItem.type}>
          {sceneFallback || territoryGeometryFallback ? (
            <div
              className={styles.previewFallback}
              data-showcase-fallback
              data-showcase-geometry-fallback={territoryGeometryFallback ? "" : undefined}
            >
              {selectedItem.type === "dice" ? (
                <ProfileCosmeticImage
                  src={previewSource(selectedItem)}
                  alt={`Prévia 2D de ${selectedItem.name}`}
                  width={680}
                  height={680}
                  priority
                  fallbackLabel="DADO"
                />
              ) : (
                <TerritoryShowcaseFallback
                  cosmeticId={selectedItem.id}
                  assetRef={selectedItem.assetRef}
                  effectKey={selectedItem.effectKey}
                />
              )}
            </div>
          ) : null}
          <span className={styles.stageMarker}>
            {sceneFallback || territoryGeometryFallback
              ? "EXPOSITOR 2D // FALLBACK CANÔNICO"
              : selectedItem.type === "dice"
                ? "EXPOSITOR 3D // GEOMETRIA CANÔNICA"
                : "EXPOSITOR 3D // TERRITÓRIO CANÔNICO"}
          </span>
        </div>

        <button
          type="button"
          className={`${styles.stageArrow} ${styles.stageArrowNext}`}
          style={{ pointerEvents: "auto" }}
          aria-label="Exibir próximo item"
          disabled={itemCount <= 1 || transitionPhase !== "idle"}
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
              ref={index === selectedIndex ? selectedStripItemRef : undefined}
              type="button"
              aria-current={index === selectedIndex ? "true" : undefined}
              aria-pressed={index === selectedIndex}
              data-active={index === selectedIndex ? "true" : "false"}
              disabled={transitionPhase !== "idle"}
              onClick={() => {
                const direction: -1 | 1 = index >= selectedIndex ? 1 : -1;
                requestSelection(item.id, direction);
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