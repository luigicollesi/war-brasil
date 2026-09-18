"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type {
  CosmeticCatalogItem,
  EconomyOffer,
  EconomyStorefrontSnapshot,
  StorefrontCollection,
} from "@/src/lib/economy/economy-contract";
import { cosmeticPreviewSource } from "@/src/lib/economy/cosmetic-preview";
import {
  ShowcasePurchaseError,
  purchaseShowcaseOffer,
} from "@/src/lib/client/store-showcase/purchase-showcase-offer";
import { ProfileCosmeticImage } from "./profile-cosmetic-image";
import commerceStyles from "./profile-store-commerce.module.css";
import styles from "./profile-store.module.css";

const INTEGER_FORMAT = new Intl.NumberFormat("pt-BR");
const BRL_FORMAT = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const AVAILABILITY_DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
});

type ShowcaseKind = "offer" | "collection";

function showcaseHref(kind: ShowcaseKind, id: string, selectedItemId?: string) {
  const base = `/profile/store/showcase/${kind}/${encodeURIComponent(id)}`;
  return selectedItemId ? `${base}?item=${encodeURIComponent(selectedItemId)}` : base;
}

function previewItem(offer: EconomyOffer) {
  return offer.items.find((item) => cosmeticPreviewSource(item) !== null) ?? offer.items[0] ?? null;
}

function itemArtwork(item: CosmeticCatalogItem | null) {
  return item ? cosmeticPreviewSource(item) : null;
}

function ownershipLabel(offer: EconomyOffer) {
  if (offer.fullyOwned) return "POSSUÍDO";
  if (offer.partiallyOwned) return `${offer.ownedCount}/${offer.totalCount} POSSUÍDOS`;
  return offer.purchasable ? "DISPONÍVEL" : "INDISPONÍVEL";
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

type StorePurchaseMessage = Readonly<{
  kind: "success" | "error";
  text: string;
}>;

function storePurchaseErrorMessage(error: ShowcasePurchaseError) {
  if (error.code === "ECONOMY_PRICE_CHANGED") {
    return error.currentPrice === null
      ? "O preço mudou. Atualize a Intendência antes de tentar novamente."
      : `O preço mudou para ${INTEGER_FORMAT.format(error.currentPrice)} CR.`;
  }
  if (error.code === "ECONOMY_INSUFFICIENT_BALANCE") {
    return "Créditos insuficientes para concluir esta compra.";
  }
  if (error.code === "ECONOMY_OFFER_ALREADY_OWNED") {
    return "Este conteúdo já pertence ao seu Arsenal.";
  }
  return error.retryable
    ? "Não foi possível confirmar a compra. Tente novamente."
    : error.message;
}

function shouldRefreshStoreAfterError(error: ShowcasePurchaseError) {
  return (
    error.code === "ECONOMY_PRICE_CHANGED" ||
    error.code === "ECONOMY_OFFER_ALREADY_OWNED" ||
    error.code === "ECONOMY_OFFER_UNAVAILABLE"
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

export function ProfileStore({ storefront }: { storefront: EconomyStorefrontSnapshot }) {
  const router = useRouter();
  const [pendingOfferId, setPendingOfferId] = useState<string | null>(null);
  const [purchaseMessage, setPurchaseMessage] = useState<StorePurchaseMessage | null>(null);

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
    () => campaignFeaturedOffer ?? normalOffers.find((offer) => offer.featured) ?? normalOffers[0] ?? null,
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

  async function handlePurchase(offer: EconomyOffer) {
    if (offer.fullyOwned || !offer.purchasable || pendingOfferId !== null) return;

    setPendingOfferId(offer.id);
    setPurchaseMessage(null);

    try {
      await purchaseShowcaseOffer({
        offerId: offer.id,
        expectedPrice: offer.price,
      });
      setPurchaseMessage({
        kind: "success",
        text: `Compra de ${offer.name} confirmada. Arsenal e saldo atualizados.`,
      });
      router.refresh();
    } catch (error) {
      if (error instanceof ShowcasePurchaseError) {
        setPurchaseMessage({
          kind: "error",
          text: storePurchaseErrorMessage(error),
        });
        if (shouldRefreshStoreAfterError(error)) router.refresh();
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

  return (
    <div className={styles.store} data-profile-v4-surface="store">
      <nav className={styles.storeNav} aria-label="Navegação da Intendência">
        <a href="#store-highlights">DESTAQUES</a>
        <a href="#store-dice">DADOS</a>
        <a href="#store-territories">TERRITÓRIOS</a>
        <a href="#store-collections">COLEÇÕES</a>
      </nav>

      {purchaseMessage ? (
        <div
          className={commerceStyles.purchaseFeedback}
          data-kind={purchaseMessage.kind}
          role="status"
          aria-live="polite"
        >
          <span>{purchaseMessage.text}</span>
        </div>
      ) : null}

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
                "Explore coleções e equipamentos. A inspeção detalhada e a aquisição acontecem no Expositor."}
          </p>
          {featuredCollection?.featured ? (
            <Link
              className={styles.heroAction}
              href={showcaseHref("collection", featuredCollection.id)}
            >
              INSPECIONAR COLEÇÃO
            </Link>
          ) : featured ? (
            <Link className={styles.heroAction} href={showcaseHref("offer", featured.id)}>
              INSPECIONAR DESTAQUE
            </Link>
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
              const href = showcaseHref("offer", offer.id);
              return (
                <article key={offer.id} className={styles.productCard}>
                  <Link className={styles.productSelect} href={href}>
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
                      <small>{offer.status === "retired" ? "ARQUIVADO" : ownershipLabel(offer)}</small>
                      <strong>{offer.name}</strong>
                      <em>{offer.items.length > 1 ? `${offer.items.length} ITENS` : ownershipLabel(offer)}</em>
                    </span>
                  </Link>
                  <div className={commerceStyles.productCommerce}>
                    <CampaignCreditAmount amount={offer.price} />
                    <button
                      type="button"
                      aria-label={`Comprar ${offer.name}`}
                      disabled={
                        offer.fullyOwned ||
                        !offer.purchasable ||
                        pendingOfferId !== null
                      }
                      onClick={() => void handlePurchase(offer)}
                    >
                      {offer.fullyOwned
                        ? "POSSUÍDO"
                        : pendingOfferId === offer.id
                          ? "PROCESSANDO..."
                          : offer.purchasable
                            ? "COMPRAR"
                            : "INDISPONÍVEL"}
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
              const content = (
                <>
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
                    <small>{offer ? ownershipLabel(offer) : skin.status === "available" ? "CATÁLOGO" : "ANUNCIADO"}</small>
                    <strong>{skin.name}</strong>
                    <em>
                      {skin.owned
                        ? skin.equipped
                          ? "EQUIPADO"
                          : "POSSUÍDO"
                        : offer
                          ? "EXPOSITOR DISPONÍVEL"
                          : "EM BREVE"}
                    </em>
                  </span>
                </>
              );

              return (
                <article key={skin.id} className={styles.productCard}>
                  {offer ? (
                    <Link
                      className={styles.productSelect}
                      href={showcaseHref("offer", offer.id, skin.id)}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className={styles.productSelect}>{content}</div>
                  )}
                  {offer ? (
                    <div className={commerceStyles.productCommerce}>
                      <CampaignCreditAmount amount={offer.price} />
                      <button
                        type="button"
                        aria-label={`Comprar ${skin.name}`}
                        disabled={
                          offer.fullyOwned ||
                          !offer.purchasable ||
                          pendingOfferId !== null
                        }
                        onClick={() => void handlePurchase(offer)}
                      >
                        {offer.fullyOwned
                          ? "POSSUÍDO"
                          : pendingOfferId === offer.id
                            ? "PROCESSANDO..."
                            : offer.purchasable
                              ? "COMPRAR"
                              : "INDISPONÍVEL"}
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
                <Link
                  className={styles.collectionBannerButton}
                  href={showcaseHref("collection", collection.id)}
                  aria-label={`Inspecionar coleção ${collection.name}`}
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
                </Link>
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
