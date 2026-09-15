"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CosmeticCatalogItem,
  CosmeticSlot,
  EconomyOffer,
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

const INTEGER_FORMAT = new Intl.NumberFormat("pt-BR");
const BRL_FORMAT = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type PurchaseFeedback = Readonly<{
  kind: "success" | "error";
  message: string;
  balance?: number;
}>;

function previewItem(offer: EconomyOffer) {
  return offer.items.find((item) => cosmeticPreviewSource(item) !== null) ?? offer.items[0] ?? null;
}

function itemArtwork(item: CosmeticCatalogItem | null) {
  return item ? cosmeticPreviewSource(item) : null;
}

function ownershipLabel(offer: EconomyOffer) {
  if (offer.fullyOwned) return "POSSUÍDO";
  if (offer.partiallyOwned) return `${offer.ownedCount}/${offer.totalCount} POSSUÍDOS`;
  return offer.status === "available" ? "DISPONÍVEL" : "INDISPONÍVEL";
}

function purchaseLabel(offer: EconomyOffer, pending: boolean) {
  if (pending) return "PROCESSANDO...";
  if (offer.fullyOwned) return "POSSUÍDO";
  if (!offer.purchasable) return "INDISPONÍVEL";
  return "COMPRAR";
}

function CampaignCreditAmount({ amount }: { amount: number }) {
  return (
    <span className={styles.creditAmount} aria-label={`${INTEGER_FORMAT.format(amount)} Créditos de Campanha`}>
      <Image src="/coin.svg" alt="" width={22} height={22} aria-hidden="true" />
      <strong>{INTEGER_FORMAT.format(amount)}</strong>
    </span>
  );
}

function InspectionContent({
  selectedOffer,
  selectedItem,
  selectedArtwork,
  titleId,
  pendingOfferId,
  onSelectItem,
  onPurchase,
}: {
  selectedOffer: EconomyOffer | null;
  selectedItem: CosmeticCatalogItem | null;
  selectedArtwork: string | null;
  titleId: string;
  pendingOfferId: string | null;
  onSelectItem: (itemId: string) => void;
  onPurchase: (offer: EconomyOffer) => void;
}) {
  const pending = selectedOffer?.id === pendingOfferId;

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
        <small>INSPEÇÃO // CATÁLOGO</small>
        <h2 id={titleId}>{selectedOffer?.name ?? "Selecione uma oferta"}</h2>
        <p>{selectedOffer?.description ?? "Nenhuma descrição de catálogo disponível."}</p>

        {selectedOffer ? (
          <div className={styles.itemSelector} role="group" aria-label={`Itens de ${selectedOffer.name}`}>
            {selectedOffer.items.map((item) => (
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

        {selectedOffer ? (
          <div className={styles.commerceBoundary}>
            <span>AQUISIÇÃO // {ownershipLabel(selectedOffer)}</span>
            <CampaignCreditAmount amount={selectedOffer.price} />
            {selectedOffer.partiallyOwned ? (
              <p>
                Você já possui {selectedOffer.ownedCount} de {selectedOffer.totalCount} itens. O pacote mantém o valor integral e entrega apenas os itens ausentes.
              </p>
            ) : null}
            <button
              type="button"
              className={styles.purchaseButton}
              disabled={!selectedOffer.purchasable || pending || pendingOfferId !== null}
              onClick={() => onPurchase(selectedOffer)}
            >
              {purchaseLabel(selectedOffer, pending)}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}

export function ProfileStore({ storefront }: { storefront: EconomyStorefrontSnapshot }) {
  const router = useRouter();
  const featured = useMemo(
    () => storefront.offers.find((offer) => offer.featured) ?? storefront.offers[0] ?? null,
    [storefront.offers],
  );
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(featured?.id ?? null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(featured ? previewItem(featured)?.id ?? null : null);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [pendingOfferId, setPendingOfferId] = useState<string | null>(null);
  const [purchaseFeedback, setPurchaseFeedback] = useState<PurchaseFeedback | null>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const inspectionReturnFocusRef = useRef<HTMLElement | null>(null);

  const selectedOffer = storefront.offers.find((offer) => offer.id === selectedOfferId) ?? featured;
  const selectedItem = selectedOffer
    ? selectedOffer.items.find((item) => item.id === selectedItemId) ?? previewItem(selectedOffer)
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

  function inspect(offer: EconomyOffer) {
    if (document.activeElement instanceof HTMLElement) {
      inspectionReturnFocusRef.current = document.activeElement;
    }
    setSelectedOfferId(offer.id);
    setSelectedItemId(previewItem(offer)?.id ?? null);
    setInspectionOpen(true);
  }

  async function purchase(offer: EconomyOffer) {
    if (pendingOfferId) return;
    if (!offer.purchasable || offer.fullyOwned) return;

    setPendingOfferId(offer.id);
    setPurchaseFeedback(null);
    const idempotencyKey = crypto.randomUUID();

    try {
      const response = await fetch("/api/economy/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: offer.id, idempotencyKey }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string; wallet?: { balance?: number } }
        | null;

      if (!response.ok) {
        const message =
          payload?.error === "ECONOMY_INSUFFICIENT_BALANCE"
            ? "Créditos de Campanha insuficientes para esta aquisição."
            : payload?.message ?? "A aquisição não pôde ser concluída agora.";
        setPurchaseFeedback({ kind: "error", message });
        return;
      }

      setPurchaseFeedback({
        kind: "success",
        message: "Aquisição confirmada e incorporada ao Arsenal.",
        balance: typeof payload?.wallet?.balance === "number" ? payload.wallet.balance : undefined,
      });
      router.refresh();
    } catch {
      setPurchaseFeedback({
        kind: "error",
        message: "A aquisição não pôde ser concluída agora.",
      });
    } finally {
      setPendingOfferId(null);
    }
  }

  return (
    <div className={styles.store} data-profile-v4-surface="store">
      <section className={styles.hero} aria-labelledby="store-title">
        <div className={styles.heroCopy}>
          <small>INTENDÊNCIA // CATÁLOGO COSMÉTICO</small>
          <h1 id="store-title">Remessas do Comando</h1>
          <p>
            Inspecione equipamentos, confira sua posse e adquira remessas disponíveis com Créditos de Campanha.
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
            {featured ? <CampaignCreditAmount amount={featured.price} /> : null}
          </div>
        </div>
      </section>

      {purchaseFeedback ? (
        <div
          className={styles.purchaseFeedback}
          data-kind={purchaseFeedback.kind}
          role="status"
          aria-live="polite"
        >
          <span>{purchaseFeedback.message}</span>
          {typeof purchaseFeedback.balance === "number" ? (
            <CampaignCreditAmount amount={purchaseFeedback.balance} />
          ) : null}
        </div>
      ) : null}

      <section className={styles.catalog} aria-labelledby="catalog-title">
        <header className={styles.sectionHeading}>
          <span>
            <small>CATÁLOGO SINCRONIZADO</small>
            <h2 id="catalog-title">Ofertas</h2>
          </span>
          <strong>{storefront.offers.length.toString().padStart(2, "0")}</strong>
        </header>

        {storefront.offers.length > 0 ? (
          <div className={styles.catalogGrid}>
            {storefront.offers.map((offer) => {
              const art = itemArtwork(previewItem(offer));
              const active = selectedOffer?.id === offer.id;
              const pending = pendingOfferId === offer.id;
              return (
                <article key={offer.id} className={styles.productCard} data-active={active ? "true" : "false"}>
                  <button type="button" className={styles.productSelect} onClick={() => inspect(offer)}>
                    <span className={styles.productVisual}>
                      <ProfileCosmeticImage
                        src={art}
                        alt={`Prévia de ${offer.name}`}
                        width={300}
                        height={300}
                        fallbackClassName={styles.productFallback}
                        fallbackLabel="WB"
                      />
                    </span>
                    <span className={styles.productCopy}>
                      <small>{offer.status === "retired" ? "ARQUIVADO" : offer.status === "available" ? "DISPONÍVEL" : "INDISPONÍVEL"}</small>
                      <strong>{offer.name}</strong>
                      <em>{ownershipLabel(offer)}</em>
                    </span>
                  </button>
                  <div className={styles.productCommerce}>
                    <CampaignCreditAmount amount={offer.price} />
                    <button
                      type="button"
                      disabled={!offer.purchasable || pending || pendingOfferId !== null}
                      onClick={() => purchase(offer)}
                    >
                      {purchaseLabel(offer, pending)}
                    </button>
                  </div>
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
          selectedOffer={selectedOffer}
          selectedItem={selectedItem}
          selectedArtwork={selectedArtwork}
          titleId="inspection-title-desktop"
          pendingOfferId={pendingOfferId}
          onSelectItem={setSelectedItemId}
          onPurchase={purchase}
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
                <strong>{selectedOffer?.name ?? "Oferta"}</strong>
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
                selectedOffer={selectedOffer}
                selectedItem={selectedItem}
                selectedArtwork={selectedArtwork}
                titleId="inspection-title-mobile"
                pendingOfferId={pendingOfferId}
                onSelectItem={setSelectedItemId}
                onPurchase={purchase}
              />
            </div>
          </section>
        </>
      ) : null}

      <section id="reforcar-tesouraria" className={styles.treasury} aria-labelledby="treasury-title">
        <span className={styles.treasuryCoin} aria-hidden="true">
          <Image src="/coin.svg" alt="" width={72} height={72} />
        </span>
        <div className={styles.treasuryIntro}>
          <small>TESOURARIA // CRÉDITOS DE CAMPANHA</small>
          <h2 id="treasury-title">Reforçar Tesouraria</h2>
          <p>Pacotes previstos para reforço de saldo. A aquisição em moeda real permanece indisponível nesta versão.</p>
        </div>
        <div className={styles.creditPacks}>
          {storefront.creditPacks.map((pack) => (
            <article key={pack.id} className={styles.creditPack}>
              <span>
                <small>{pack.name}</small>
                <CampaignCreditAmount amount={pack.creditAmount} />
              </span>
              <strong>{BRL_FORMAT.format(pack.priceBrlCents / 100)}</strong>
              <button type="button" disabled>
                EM BREVE
              </button>
            </article>
          ))}
          {storefront.creditPacks.length === 0 ? (
            <span className={styles.creditPacksEmpty}>Nenhum pacote anunciado.</span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
