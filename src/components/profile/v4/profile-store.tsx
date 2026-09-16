"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CosmeticCatalogItem,
  CosmeticSlot,
  EconomyOffer,
  EconomyStorefrontSnapshot,
  StorefrontCollection,
} from "@/src/lib/economy/economy-contract";
import { cosmeticPreviewSource } from "@/src/lib/economy/cosmetic-preview";
import { ProfileCosmeticImage } from "./profile-cosmetic-image";
import collectionModalStyles from "./profile-store-collection-modal.module.css";
import commerceStyles from "./profile-store-commerce.module.css";
import mobileStyles from "./profile-store-mobile-inspection.module.css";
import styles from "./profile-store.module.css";

const SLOT_LABELS: Readonly<Record<CosmeticSlot, string>> = {
  dice_attack: "Ataque",
  dice_defense: "Defesa",
  dice_neutral: "Neutro",
  territory_skin: "Território",
};

const INTEGER_FORMAT = new Intl.NumberFormat("pt-BR");
const BRL_FORMAT = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const AVAILABILITY_DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
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
  if (offer.partiallyOwned) return "COMPLETAR";
  return "COMPRAR";
}

function collectionProgressLabel(collection: StorefrontCollection) {
  if (collection.fullyOwned) return "COLEÇÃO COMPLETA";
  if (collection.partiallyOwned) {
    return `${collection.ownedCount}/${collection.totalCount} POSSUÍDOS`;
  }
  return `${collection.totalCount} ITENS`;
}

function formattedAvailabilityDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? AVAILABILITY_DATE_FORMAT.format(date) : value;
}

function promotionLabel(discountBps: number) {
  return `${Math.round(discountBps / 100)}% OFF`;
}

function OfferRotationNotice({ offer }: { offer: EconomyOffer }) {
  if (!offer.endsAt) return null;
  return (
    <p>
      Disponível até {formattedAvailabilityDate(offer.endsAt)}. Pode retornar à rotação futuramente.
    </p>
  );
}

function CampaignCreditAmount({ amount }: { amount: number }) {
  return (
    <span
      className={commerceStyles.creditAmount}
      aria-label={`${INTEGER_FORMAT.format(amount)} Créditos de Campanha`}
    >
      <Image src="/coin.svg" alt="" width={22} height={22} aria-hidden="true" />
      <strong>{INTEGER_FORMAT.format(amount)}</strong>
    </span>
  );
}

function PromotionalPrice({ offer }: { offer: EconomyOffer }) {
  const discounted = offer.promotionDiscountBps > 0 && offer.basePrice > offer.price;
  return (
    <span className={collectionModalStyles.priceStack}>
      {discounted ? <s>{INTEGER_FORMAT.format(offer.basePrice)} CR</s> : null}
      <strong>{INTEGER_FORMAT.format(offer.price)} CR</strong>
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
                Você já possui {selectedOffer.ownedCount} de {selectedOffer.totalCount} itens. O preço de conclusão considera apenas os itens ainda não adquiridos e aplica o desconto do conjunto sobre esse subtotal.
              </p>
            ) : null}
            <OfferRotationNotice offer={selectedOffer} />
            <button
              type="button"
              className={commerceStyles.purchaseButton}
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
  const featuredCollection = useMemo(
    () => storefront.collections.find((collection) => collection.featured) ?? storefront.collections[0] ?? null,
    [storefront.collections],
  );
  const collectionOfferIds = useMemo(
    () => new Set(storefront.collections.flatMap((collection) => collection.offerIds)),
    [storefront.collections],
  );
  const normalOffers = useMemo(
    () => storefront.offers.filter((offer) => !collectionOfferIds.has(offer.id)),
    [collectionOfferIds, storefront.offers],
  );
  const activeCampaign = storefront.campaigns[0] ?? null;
  const campaignFeaturedOffer = activeCampaign
    ? activeCampaign.offerIds
        .map((offerId) => normalOffers.find((offer) => offer.id === offerId) ?? null)
        .find((offer): offer is EconomyOffer => offer !== null) ?? null
    : null;
  const featured = useMemo(
    () =>
      campaignFeaturedOffer ??
      normalOffers.find((offer) => offer.featured) ??
      normalOffers[0] ??
      null,
    [campaignFeaturedOffer, normalOffers],
  );
  const diceOffers = useMemo(
    () =>
      storefront.offers.filter(
        (offer) =>
          !collectionOfferIds.has(offer.id) &&
          offer.items.length > 0 &&
          offer.items.every(
            (item) =>
              item.slot === "dice_attack" ||
              item.slot === "dice_defense" ||
              item.slot === "dice_neutral",
          ),
      ),
    [collectionOfferIds, storefront.offers],
  );
  const territoryOfferByCosmeticId = useMemo(() => {
    const offers = new Map<string, EconomyOffer>();
    for (const offer of storefront.offers) {
      if (collectionOfferIds.has(offer.id) || offer.items.length !== 1) continue;
      const [item] = offer.items;
      if (item.slot === "territory_skin") offers.set(item.id, offer);
    }
    return offers;
  }, [collectionOfferIds, storefront.offers]);

  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(featured?.id ?? null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    featured ? previewItem(featured)?.id ?? null : null,
  );
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(
    featuredCollection?.id ?? null,
  );
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [pendingOfferId, setPendingOfferId] = useState<string | null>(null);
  const [purchaseFeedback, setPurchaseFeedback] = useState<PurchaseFeedback | null>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const collectionCloseRef = useRef<HTMLButtonElement>(null);
  const inspectionReturnFocusRef = useRef<HTMLElement | null>(null);
  const collectionReturnFocusRef = useRef<HTMLElement | null>(null);

  const selectedOffer = storefront.offers.find((offer) => offer.id === selectedOfferId) ?? featured;
  const selectedItem = selectedOffer
    ? selectedOffer.items.find((item) => item.id === selectedItemId) ?? previewItem(selectedOffer)
    : null;
  const selectedArtwork = itemArtwork(selectedItem);
  const selectedCollection =
    storefront.collections.find((collection) => collection.id === selectedCollectionId) ??
    featuredCollection;
  const selectedCollectionOffers = selectedCollection
    ? selectedCollection.offerIds
        .map((offerId) => storefront.offers.find((offer) => offer.id === offerId) ?? null)
        .filter((offer): offer is EconomyOffer => offer !== null)
    : [];
  const selectedCollectionSingles = selectedCollection
    ? selectedCollection.singleOfferIds
        .map((offerId) => storefront.offers.find((offer) => offer.id === offerId) ?? null)
        .filter((offer): offer is EconomyOffer => offer !== null)
    : [];
  const selectedCollectionBundle = selectedCollection
    ? selectedCollection.bundleOfferIds
        .map((offerId) => storefront.offers.find((offer) => offer.id === offerId) ?? null)
        .find((offer): offer is EconomyOffer => offer !== null) ?? null
    : null;
  const selectedCollectionSingleByItem = useMemo(
    () =>
      new Map(
        selectedCollectionSingles.map((offer) => [offer.items[0]?.id ?? offer.id, offer] as const),
      ),
    [selectedCollectionSingles],
  );

  const closeInspection = useCallback(() => {
    setInspectionOpen(false);
    const returnTarget = inspectionReturnFocusRef.current;
    if (returnTarget) {
      window.requestAnimationFrame(() => {
        if (returnTarget.isConnected) returnTarget.focus();
      });
    }
  }, []);

  const closeCollection = useCallback(() => {
    setCollectionModalOpen(false);
    const returnTarget = collectionReturnFocusRef.current;
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

  useEffect(() => {
    if (!collectionModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCollection();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    window.requestAnimationFrame(() => collectionCloseRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeCollection, collectionModalOpen]);

  function inspect(offer: EconomyOffer) {
    if (document.activeElement instanceof HTMLElement) {
      inspectionReturnFocusRef.current = document.activeElement;
    }
    setSelectedOfferId(offer.id);
    setSelectedItemId(previewItem(offer)?.id ?? null);
    setInspectionOpen(true);
  }

  function openCollection(collection: StorefrontCollection) {
    if (document.activeElement instanceof HTMLElement) {
      collectionReturnFocusRef.current = document.activeElement;
    }
    setSelectedCollectionId(collection.id);
    setCollectionModalOpen(true);
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
        body: JSON.stringify({
          offerId: offer.id,
          idempotencyKey,
          expectedPrice: offer.price,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            message?: string;
            currentPrice?: number;
            wallet?: { balance?: number };
          }
        | null;

      if (
        response.status === 409 &&
        payload?.error === "ECONOMY_PRICE_CHANGED" &&
        typeof payload.currentPrice === "number"
      ) {
        setPurchaseFeedback({
          kind: "error",
          message: `O preço foi atualizado para ${INTEGER_FORMAT.format(payload.currentPrice)} créditos. Confirme novamente antes de adquirir.`,
        });
        router.refresh();
        return;
      }

      if (response.status === 409 && payload?.error === "ECONOMY_OFFER_UNAVAILABLE") {
        setPurchaseFeedback({
          kind: "error",
          message: "A oferta não está mais disponível. A Intendência foi atualizada.",
        });
        router.refresh();
        return;
      }

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
      <nav className={styles.storeNav} aria-label="Navegação da Intendência">
        <a href="#store-highlights">DESTAQUES</a>
        <a href="#store-dice">DADOS</a>
        <a href="#store-territories">TERRITÓRIOS</a>
        <a href="#store-collections">COLEÇÕES</a>
      </nav>

      <section id="store-highlights" className={styles.hero} aria-labelledby="store-title">
        <div className={styles.heroCopy}>
          <small>
            {featuredCollection?.featured
              ? "DESTAQUE ESPECIAL // COLEÇÃO"
              : activeCampaign
                ? "OPERAÇÃO ATIVA // INTENDÊNCIA"
                : "INTENDÊNCIA // ARSENAL COSMÉTICO"}
          </small>
          <h1 id="store-title">
            {featuredCollection?.featured
              ? featuredCollection.name
              : activeCampaign?.title ?? "Remessas do Comando"}
          </h1>
          <p>
            {featuredCollection?.featured
              ? featuredCollection.description ?? "Coleção especial em destaque na Intendência."
              : activeCampaign?.description ??
                "Explore coleções, inspecione equipamentos e adquira apenas os componentes que ainda faltam ao seu Arsenal."}
          </p>
          {featuredCollection?.featured ? (
            <button type="button" onClick={() => openCollection(featuredCollection)}>
              ABRIR COLEÇÃO EM DESTAQUE
            </button>
          ) : activeCampaign && campaignFeaturedOffer ? (
            <button type="button" onClick={() => inspect(campaignFeaturedOffer)}>
              INSPECIONAR OPERAÇÃO
            </button>
          ) : featured ? (
            <button type="button" onClick={() => inspect(featured)}>
              INSPECIONAR DESTAQUE
            </button>
          ) : null}
        </div>
        <div className={styles.heroVisual}>
          {featuredCollection?.featured ? (
            <ProfileCosmeticImage
              src={featuredCollection.assets.banner}
              alt={`Banner da coleção ${featuredCollection.name}`}
              width={900}
              height={500}
              priority
              fallbackLabel="COLEÇÃO"
            />
          ) : activeCampaign && campaignFeaturedOffer ? (
            <ProfileCosmeticImage
              src={itemArtwork(previewItem(campaignFeaturedOffer))}
              alt={`Destaque da operação ${activeCampaign.title}`}
              width={520}
              height={520}
              priority
              fallbackLabel="OPERAÇÃO"
            />
          ) : (
            <ProfileCosmeticImage
              src={featured ? itemArtwork(previewItem(featured)) : null}
              alt={featured ? `Destaque ${featured.name}` : "Destaque do catálogo"}
              width={520}
              height={520}
              priority
              fallbackLabel="SEM PRÉVIA"
            />
          )}
          <div>
            <small>
              {featuredCollection?.featured
                ? `ESPECIAL // ${promotionLabel(featuredCollection.promotionDiscountBps)}`
                : activeCampaign
                  ? "OPERAÇÃO EM CURSO"
                  : "DESTAQUE ATUAL"}
            </small>
            <strong>
              {featuredCollection?.featured
                ? featuredCollection.name
                : activeCampaign?.title ?? featured?.name ?? "Nenhuma remessa disponível"}
            </strong>
            {featuredCollection?.featured ? (
              <span>{collectionProgressLabel(featuredCollection)}</span>
            ) : activeCampaign?.endsAt ? (
              <span>Até {formattedAvailabilityDate(activeCampaign.endsAt)}</span>
            ) : featured ? (
              <CampaignCreditAmount amount={featured.price} />
            ) : null}
          </div>
        </div>
      </section>

      {purchaseFeedback ? (
        <div
          className={commerceStyles.purchaseFeedback}
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

      <section id="store-dice" className={styles.catalog} aria-labelledby="catalog-title">
        <header className={styles.sectionHeading}>
          <span>
            <small>DADOS // CATÁLOGO PERMANENTE</small>
            <h2 id="catalog-title">Dados</h2>
          </span>
          <strong>{diceOffers.length.toString().padStart(2, "0")}</strong>
        </header>

        {diceOffers.length > 0 ? (
          <div className={styles.catalogGrid}>
            {diceOffers.map((offer) => {
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
                  <div className={commerceStyles.productCommerce}>
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
            <strong>Nenhuma remessa de dados disponível</strong>
            <span>A Intendência continua acessível enquanto o catálogo é restabelecido.</span>
          </div>
        )}
      </section>

      <section id="store-territories" className={styles.catalog} aria-labelledby="territories-title">
        <header className={styles.sectionHeading}>
          <span>
            <small>TERRITÓRIOS // CATÁLOGO PERMANENTE</small>
            <h2 id="territories-title">Territórios</h2>
          </span>
          <strong>{storefront.territorySkins.length.toString().padStart(2, "0")}</strong>
        </header>

        {storefront.territorySkins.length > 0 ? (
          <div className={styles.catalogGrid}>
            {storefront.territorySkins.map((skin) => {
              const offer = territoryOfferByCosmeticId.get(skin.id) ?? null;
              const pending = offer?.id === pendingOfferId;
              return (
                <article key={skin.id} className={styles.productCard}>
                  <div className={styles.productSelect}>
                    <span className={styles.productVisual}>
                      <ProfileCosmeticImage
                        src={itemArtwork(skin)}
                        alt={`Prévia de ${skin.name}`}
                        width={420}
                        height={300}
                        fallbackClassName={styles.productFallback}
                        fallbackLabel="SKIN"
                      />
                    </span>
                    <span className={styles.productCopy}>
                      <small>{offer ? "DISPONÍVEL" : skin.status === "available" ? "CATÁLOGO" : "ANUNCIADO"}</small>
                      <strong>{skin.name}</strong>
                      <em>
                        {skin.owned
                          ? skin.equipped
                            ? "EQUIPADO"
                            : "POSSUÍDO"
                          : offer
                            ? ownershipLabel(offer)
                            : "EM BREVE"}
                      </em>
                    </span>
                  </div>
                  {offer ? (
                    <div className={commerceStyles.productCommerce}>
                      <CampaignCreditAmount amount={offer.price} />
                      <button
                        type="button"
                        disabled={!offer.purchasable || pending || pendingOfferId !== null}
                        onClick={() => purchase(offer)}
                      >
                        {purchaseLabel(offer, pending)}
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyCatalog}>
            <strong>Nenhum acabamento territorial anunciado</strong>
            <span>Novas camadas visuais aparecerão aqui quando entrarem no catálogo.</span>
          </div>
        )}
      </section>

      <section id="store-collections" className={styles.catalog} aria-labelledby="collections-title">
        <header className={styles.sectionHeading}>
          <span>
            <small>COLEÇÕES // EDIÇÕES ESPECIAIS</small>
            <h2 id="collections-title">Coleções</h2>
          </span>
          <strong>{storefront.collections.length.toString().padStart(2, "0")}</strong>
        </header>

        {storefront.collections.length > 0 ? (
          <div className={styles.collectionGrid}>
            {storefront.collections.map((collection) => (
              <article
                key={collection.id}
                className={styles.collectionBannerCard}
                data-featured={collection.featured ? "true" : "false"}
              >
                <button
                  type="button"
                  className={styles.collectionBannerButton}
                  aria-label={`Abrir coleção ${collection.name}`}
                  onClick={() => openCollection(collection)}
                >
                  <ProfileCosmeticImage
                    src={collection.assets.banner}
                    alt={`Banner da coleção ${collection.name}`}
                    width={900}
                    height={500}
                    fallbackClassName={styles.productFallback}
                    fallbackLabel="COLEÇÃO"
                  />
                  <span className={styles.collectionBannerMeta}>
                    <span>
                      <small>{collection.featured ? "DESTAQUE ESPECIAL" : "COLEÇÃO"}</small>
                      <strong>{collection.name}</strong>
                    </span>
                    <em>
                      {collection.promotionDiscountBps > 0
                        ? promotionLabel(collection.promotionDiscountBps)
                        : collectionProgressLabel(collection)}
                    </em>
                  </span>
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyCatalog}>
            <strong>Nenhuma coleção editorial disponível</strong>
            <span>As ofertas individuais continuam acessíveis acima.</span>
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

      {collectionModalOpen && selectedCollection ? (
        <div
          className={collectionModalStyles.overlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCollection();
          }}
        >
          <section
            className={collectionModalStyles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="collection-modal-title"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(3,13,10,.94), rgba(3,13,10,.7)), url("${selectedCollection.assets.background}")`,
            }}
          >
            <button
              ref={collectionCloseRef}
              type="button"
              className={collectionModalStyles.close}
              aria-label="Fechar coleção"
              onClick={closeCollection}
            >
              ×
            </button>

            <header className={collectionModalStyles.header}>
              <div className={collectionModalStyles.logo}>
                <ProfileCosmeticImage
                  src={selectedCollection.assets.logo}
                  alt={`Logo da coleção ${selectedCollection.name}`}
                  width={420}
                  height={220}
                  fallbackLabel={selectedCollection.name}
                />
              </div>
              <div className={collectionModalStyles.headerCopy}>
                <small>COLEÇÃO // {collectionProgressLabel(selectedCollection)}</small>
                <h2 id="collection-modal-title">{selectedCollection.name}</h2>
                <p>{selectedCollection.description ?? "Coleção temática do Arsenal do Comando."}</p>
                {selectedCollection.promotionDiscountBps > 0 ? (
                  <span className={collectionModalStyles.promotionBadge}>
                    DESTAQUE ESPECIAL // {promotionLabel(selectedCollection.promotionDiscountBps)}
                  </span>
                ) : null}
              </div>
            </header>

            <div className={collectionModalStyles.body}>
              <div
                className={collectionModalStyles.collectionItems}
                role="list"
                aria-label={`Cosméticos da coleção ${selectedCollection.name}`}
              >
                {selectedCollection.items.map((item) => {
                  const offer = selectedCollectionSingleByItem.get(item.id) ?? null;
                  const pending = offer?.id === pendingOfferId;
                  return (
                    <article key={item.id} className={collectionModalStyles.itemCard} role="listitem">
                      <div className={collectionModalStyles.itemArt}>
                        <ProfileCosmeticImage
                          src={itemArtwork(item)}
                          alt={`Prévia de ${item.name}`}
                          width={320}
                          height={320}
                          fallbackLabel={SLOT_LABELS[item.slot]}
                        />
                      </div>
                      <div className={collectionModalStyles.itemCopy}>
                        <small>{SLOT_LABELS[item.slot]}</small>
                        <strong>{item.name}</strong>
                        <span>{item.owned ? (item.equipped ? "EQUIPADO" : "POSSUÍDO") : "NÃO ADQUIRIDO"}</span>
                      </div>
                      <div className={collectionModalStyles.itemAction}>
                        {offer ? <PromotionalPrice offer={offer} /> : <span>SEM OFERTA</span>}
                        <button
                          type="button"
                          disabled={!offer?.purchasable || pending || pendingOfferId !== null}
                          onClick={() => offer && purchase(offer)}
                        >
                          {offer ? purchaseLabel(offer, pending) : "INDISPONÍVEL"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {selectedCollectionBundle ? (
                <div className={collectionModalStyles.bundlePurchase}>
                  <span className={collectionModalStyles.bundleIcon} aria-hidden="true">
                    <ProfileCosmeticImage
                      src={selectedCollection.assets.logo}
                      alt=""
                      width={92}
                      height={92}
                      fallbackLabel="SET"
                    />
                  </span>
                  <div className={collectionModalStyles.bundleCopy}>
                    <small>
                      CONJUNTO // {selectedCollection.partiallyOwned ? "CONCLUSÃO" : "80% DO VALOR INDIVIDUAL"}
                    </small>
                    <strong>Adquirir coleção {selectedCollection.name}</strong>
                    <PromotionalPrice offer={selectedCollectionBundle} />
                    <p>
                      {selectedCollection.partiallyOwned
                        ? "O valor considera apenas os itens ainda não adquiridos, aplica o desconto normal da coleção e depois a promoção ativa."
                        : "O conjunto custa 80% da soma dos itens individuais. Uma promoção de destaque, quando ativa, é aplicada depois desse desconto."}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={
                      selectedCollectionBundle.fullyOwned ||
                      !selectedCollectionBundle.purchasable ||
                      pendingOfferId !== null
                    }
                    onClick={() => purchase(selectedCollectionBundle)}
                  >
                    {selectedCollection.fullyOwned
                      ? "COLEÇÃO ADQUIRIDA"
                      : selectedCollection.partiallyOwned
                        ? "COMPLETAR COLEÇÃO"
                        : "COMPRAR COLEÇÃO"}
                  </button>
                </div>
              ) : selectedCollectionOffers.length === 0 ? (
                <small>Nenhuma oferta ativa vinculada a esta coleção.</small>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      <section id="reforcar-tesouraria" className={styles.treasury} aria-labelledby="treasury-title">
        <span className={styles.treasuryCoin} aria-hidden="true">
          <Image src="/coin.svg" alt="" width={72} height={72} />
        </span>
        <div className={commerceStyles.treasuryIntro}>
          <small>TESOURARIA // CRÉDITOS DE CAMPANHA</small>
          <h2 id="treasury-title">Reforçar Tesouraria</h2>
          <p>Pacotes previstos para reforço de saldo. A aquisição em moeda real permanece indisponível nesta versão.</p>
        </div>
        <div className={commerceStyles.creditPacks}>
          {storefront.creditPacks.map((pack) => (
            <article key={pack.id} className={commerceStyles.creditPack}>
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
            <span className={commerceStyles.creditPacksEmpty}>Nenhum pacote anunciado.</span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
