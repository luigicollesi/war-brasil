"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CosmeticCatalogItem,
  EconomyOffer,
  EconomyStorefrontSnapshot,
  StorefrontCollection,
} from "@/src/lib/economy/economy-contract";
import type { ProfileAppearanceStorefront } from "@/src/lib/economy/profile-appearance-store-contract";
import { TerritorySkinPreview } from "@/src/components/economy/territory-skin-preview";
import { ProfileTitleRenderer } from "@/src/components/profile/profile-title-renderer";
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

const STORE_NAV_SECTIONS = [
  { zone: "hero", id: "store-highlights" },
  { zone: "collections", id: "store-collections" },
  { zone: "categories", id: "store-categories" },
  { zone: "treasury", id: "store-credits" },
] as const;

type StoreNavSection = (typeof STORE_NAV_SECTIONS)[number]["zone"];

function isStoreNavSection(value: string | undefined): value is StoreNavSection {
  return STORE_NAV_SECTIONS.some((section) => section.zone === value);
}

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

export function ProfileStore({
  storefront,
  appearanceStorefront,
}: {
  storefront: EconomyStorefrontSnapshot;
  appearanceStorefront: ProfileAppearanceStorefront;
}) {
  const router = useRouter();
  const storeRef = useRef<HTMLDivElement>(null);
  const [pendingOfferId, setPendingOfferId] = useState<string | null>(null);
  const [purchaseMessage, setPurchaseMessage] = useState<StorePurchaseMessage | null>(null);
  const [activeSection, setActiveSection] = useState<StoreNavSection>("hero");

  useEffect(() => {
    const store = storeRef.current;
    if (!store) return undefined;

    const animatedSections = Array.from(
      store.querySelectorAll<HTMLElement>("[data-store-zone]"),
    );
    const navSections = STORE_NAV_SECTIONS.map(({ id }) =>
      store.querySelector<HTMLElement>(`#${id}`),
    ).filter((section): section is HTMLElement => section !== null);

    if (typeof IntersectionObserver === "undefined") {
      animatedSections.forEach((section) => {
        section.setAttribute("data-v3-active", "true");
      });
      return undefined;
    }

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const target = entry.target as HTMLElement;
          target.setAttribute("data-v3-active", "true");
          revealObserver.unobserve(target);
        });
      },
      { threshold: 0.16 },
    );

    const navObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const zone = (visible[0]?.target as HTMLElement | undefined)?.dataset.storeZone;
        if (isStoreNavSection(zone)) setActiveSection(zone);
      },
      {
        rootMargin: "-26% 0px -58% 0px",
        threshold: [0, 0.15, 0.35, 0.6],
      },
    );

    animatedSections.forEach((section) => revealObserver.observe(section));
    navSections.forEach((section) => navObserver.observe(section));

    return () => {
      revealObserver.disconnect();
      navObserver.disconnect();
    };
  }, []);

  const featuredCollection = useMemo(
    () => storefront.collections.find((collection) => collection.featured) ?? storefront.collections[0] ?? null,
    [storefront.collections],
  );
  const featuredCollectionBundleOffer = useMemo(() => {
    if (!featuredCollection?.featured) return null;

    const bundleOffers = featuredCollection.bundleOfferIds
      .map((offerId) => storefront.offers.find((offer) => offer.id === offerId) ?? null)
      .filter((offer): offer is EconomyOffer => offer !== null);

    return (
      bundleOffers.find((offer) => offer.purchasable || offer.fullyOwned) ??
      bundleOffers[0] ??
      null
    );
  }, [featuredCollection, storefront.offers]);
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

  const quickDice = diceOffers[0] ?? null;
  const quickTerritory = storefront.territorySkins[0] ?? null;
  const quickBackground =
    appearanceStorefront.offers
      .flatMap((offer) => offer.items)
      .find((item) => item.kind === "profile_background") ?? null;
  const quickTitle =
    appearanceStorefront.offers
      .flatMap((offer) => offer.items)
      .find((item) => item.kind === "commander_title") ?? null;

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
    <div ref={storeRef} className={styles.store} data-profile-v4-surface="store">
      <div className={styles.storeFixedAtmosphere} aria-hidden="true">
        <span className={styles.fixedCommandStripe} />
        <span className={styles.fixedArmorPlate} />
        <span className={styles.fixedLightSweep} />
      </div>

      <div className={styles.storeAtmosphere} aria-hidden="true">
        <span className={styles.atmosphereBase} />
        <span className={styles.atmosphereOptical} />
        <span className={styles.atmospherePlatePrimary} />
        <span className={styles.atmospherePlateSecondary} />
        <span className={styles.atmosphereGhostType}>14</span>
        <span className={styles.atmosphereLight} />
        <span className={styles.atmosphereLeftMass} />
        <span className={styles.atmosphereLowerMass} />
        <span className={styles.signalClusterLeft}>WB/14 // SUPPLY</span>
        <span className={styles.signalClusterRight}>LOGISTICS // INT</span>
        <span className={styles.atmosphereVignette} />
      </div>

      <nav className={styles.storeNav} aria-label="Navegação da Intendência">
        <a
          href="#store-highlights"
          data-active={activeSection === "hero" ? "true" : "false"}
          aria-current={activeSection === "hero" ? "location" : undefined}
        >
          DESTAQUES
        </a>
        <a
          href="#store-collections"
          data-active={activeSection === "collections" ? "true" : "false"}
          aria-current={activeSection === "collections" ? "location" : undefined}
        >
          COLEÇÕES
        </a>
        <a
          href="#store-categories"
          data-active={activeSection === "categories" ? "true" : "false"}
          aria-current={activeSection === "categories" ? "location" : undefined}
        >
          CATEGORIAS
        </a>
        <a
          href="#store-credits"
          data-active={activeSection === "treasury" ? "true" : "false"}
          aria-current={activeSection === "treasury" ? "location" : undefined}
        >
          CRÉDITOS
        </a>
      </nav>      {purchaseMessage ? (
        <div
          className={commerceStyles.purchaseFeedback}
          data-kind={purchaseMessage.kind}
          role="status"
          aria-live="polite"
        >
          <span>{purchaseMessage.text}</span>
        </div>
      ) : null}

      <section
        id="store-highlights"
        className={`${styles.hero} ${featuredCollection?.featured ? styles.featuredHero : ""}`}
        data-store-zone="hero"
        data-store-layer="00"
        aria-labelledby="store-title"
      >
        <span className={styles.operationAxis} aria-hidden="true" />
        {featuredCollection?.featured ? (
          <>
            <div className={styles.featuredHeroMedia}>
              <Link
                className={styles.featuredHeroBanner}
                href={showcaseHref("collection", featuredCollection.id)}
                aria-label={`Inspecionar coleção ${featuredCollection.name} no Expositor`}
              >
                <ProfileCosmeticImage
                  src={featuredCollection.assets.banner}
                  alt={`Banner da coleção ${featuredCollection.name}`}
                  width={1440}
                  height={800}
                  priority
                  fallbackClassName={styles.featuredHeroBannerFallback}
                  fallbackLabel="COLEÇÃO"
                />
              </Link>
            </div>

            <div className={styles.featuredHeroOverlay}>
              <div className={styles.featuredHeroCopy}>
                <small>DESTAQUE ESPECIAL // COLEÇÃO</small>
                <h1 id="store-title">{featuredCollection.name}</h1>
                <span className={styles.featuredHeroHint}>CLIQUE NO BANNER PARA INSPECIONAR NO EXPOSITOR</span>
              </div>

              {featuredCollection.promotionDiscountBps > 0 ? (
                <div className={styles.featuredPromo} aria-label={promotionLabel(featuredCollection.promotionDiscountBps)}>
                  <strong>{promotionLabel(featuredCollection.promotionDiscountBps).replace(" OFF", "")}</strong>
                  <span>OFF</span>
                </div>
              ) : null}

              <div className={styles.featuredHeroCommerce}>
                <div className={styles.featuredPriceBlock}>
                  {featuredCollectionBundleOffer ? (
                    <>
                      {featuredCollectionBundleOffer.basePrice > featuredCollectionBundleOffer.price ? (
                        <span className={styles.featuredOldPrice}>
                          <CampaignCreditAmount amount={featuredCollectionBundleOffer.basePrice} />
                        </span>
                      ) : null}
                      <span className={styles.featuredCurrentPrice}>
                        <small>PREÇO DA COLEÇÃO</small>
                        <CampaignCreditAmount amount={featuredCollectionBundleOffer.price} />
                      </span>
                    </>
                  ) : (
                    <span className={styles.featuredCurrentPrice}>
                      <small>COLEÇÃO ESPECIAL</small>
                      <strong>{collectionProgressLabel(featuredCollection)}</strong>
                    </span>
                  )}
                </div>

                {featuredCollectionBundleOffer ? (
                  <button
                    type="button"
                    aria-label={`Comprar coleção ${featuredCollection.name}`}
                    disabled={
                      featuredCollectionBundleOffer.fullyOwned ||
                      !featuredCollectionBundleOffer.purchasable ||
                      pendingOfferId !== null
                    }
                    data-processing={
                      pendingOfferId === featuredCollectionBundleOffer.id ? "true" : undefined
                    }
                    onClick={() => void handlePurchase(featuredCollectionBundleOffer)}
                  >
                    {featuredCollectionBundleOffer.fullyOwned
                      ? "COLEÇÃO POSSUÍDA"
                      : pendingOfferId === featuredCollectionBundleOffer.id
                        ? "PROCESSANDO..."
                        : featuredCollectionBundleOffer.purchasable
                          ? "COMPRAR COLEÇÃO"
                          : "INDISPONÍVEL"}
                  </button>
                ) : (
                  <Link
                    className={styles.featuredInspectFallback}
                    href={showcaseHref("collection", featuredCollection.id)}
                  >
                    VER NO EXPOSITOR
                  </Link>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className={styles.heroCopy}>
              <small>
                {activeCampaign
                  ? "OPERAÇÃO ATIVA // INTENDÊNCIA"
                  : "INTENDÊNCIA // ARSENAL COSMÉTICO"}
              </small>
              <h1 id="store-title">{activeCampaign?.title ?? "Remessas do Comando"}</h1>
              <p>
                {activeCampaign?.description ??
                  "Explore coleções e equipamentos. A inspeção detalhada e a aquisição acontecem no Expositor."}
              </p>
              {featured ? (
                <Link className={styles.heroAction} href={showcaseHref("offer", featured.id)}>
                  INSPECIONAR DESTAQUE
                </Link>
              ) : null}
            </div>
            <div className={styles.heroVisual}>
              {activeCampaign && campaignFeaturedOffer ? (
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
                <small>{activeCampaign ? "OPERAÇÃO EM CURSO" : "DESTAQUE ATUAL"}</small>
                <strong>{activeCampaign?.title ?? featured?.name ?? "Nenhuma remessa disponível"}</strong>
                {activeCampaign?.endsAt ? (
                  <span>Até {formattedAvailabilityDate(activeCampaign.endsAt)}</span>
                ) : featured ? (
                  <CampaignCreditAmount amount={featured.price} />
                ) : null}
              </div>
            </div>
          </>
        )}
      </section>

      <section className={styles.quickGuide} aria-labelledby="store-quick-guide-title">
        <header className={styles.quickGuideHeading}>
          <span>
            <small>GUIA RÁPIDO // CATÁLOGOS</small>
            <h2 id="store-quick-guide-title">Encontre seu setor</h2>
          </span>
          <em>04 FLUXOS</em>
        </header>
        <div className={styles.quickGuideGrid}>
          <Link href="/profile/store/category/dice"><span>◇</span><strong>DADOS</strong><small>Combate</small></Link>
          <Link href="/profile/store/category/territories"><span>⬡</span><strong>TERRITÓRIOS</strong><small>Campo de batalha</small></Link>
          <Link href="/profile/store/category/backgrounds"><span>▱</span><strong>FUNDOS</strong><small>Dossiê</small></Link>
          <Link href="/profile/store/category/titles"><span>≡</span><strong>TÍTULOS</strong><small>Identidade</small></Link>
        </div>
      </section>

      <section
        id="store-collections"
        className={styles.catalog}
        data-store-zone="collections"
        data-store-layer="03"
        aria-labelledby="collections-title"
      >
        <span className={styles.repairPlate} aria-hidden="true" />
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

      <section
        id="store-categories"
        className={styles.catalog}
        data-store-zone="categories"
        data-store-layer="03"
        aria-labelledby="categories-title"
      >
        <span className={styles.supplyNetwork} aria-hidden="true" />
        <span className={styles.frontLine} aria-hidden="true" />
        <header className={styles.sectionHeading}>
          <span>
            <small>CATEGORIAS // CATÁLOGO DA INTENDÊNCIA</small>
            <h2 id="categories-title">Categorias</h2>
          </span>
          <strong>04</strong>
        </header>

        <div className={styles.categoryGrid}>
          <Link href="/profile/store/category/dice" className={styles.categoryCard}>
            <span className={styles.categoryVisual} data-category="dice">
              <ProfileCosmeticImage
                src={quickDice ? itemArtwork(previewItem(quickDice)) : null}
                alt="Prévia da categoria Dados"
                width={520}
                height={320}
                fallbackLabel="DADOS"
              />
            </span>
            <span className={styles.categoryCopy}>
              <small>EQUIPAMENTO DE COMBATE</small>
              <strong>DADOS</strong>
              <em>Personalize seus confrontos</em>
              <b>ABRIR CATÁLOGO →</b>
            </span>
          </Link>

          <Link href="/profile/store/category/territories" className={styles.categoryCard}>
            <span className={styles.categoryVisual} data-category="territories">
              <TerritorySkinPreview
                assetRef={quickTerritory ? itemArtwork(quickTerritory) : null}
                ariaLabel="Prévia da categoria Territórios"
              />
            </span>
            <span className={styles.categoryCopy}>
              <small>CAMPO DE BATALHA</small>
              <strong>TERRITÓRIOS</strong>
              <em>Personalize o mapa sem alterar a leitura</em>
              <b>ABRIR CATÁLOGO →</b>
            </span>
          </Link>

          <Link href="/profile/store/category/backgrounds" className={styles.categoryCard}>
            <span className={styles.categoryVisual} data-category="backgrounds">
              {quickBackground?.kind === "profile_background" ? (
                <ProfileCosmeticImage
                  src={quickBackground.previewRef ?? quickBackground.assetRef}
                  alt="Prévia da categoria Fundos"
                  width={520}
                  height={320}
                  fallbackLabel="FUNDO"
                />
              ) : (
                <span className={styles.categoryFallback}>DOSSIÊ</span>
              )}
            </span>
            <span className={styles.categoryCopy}>
              <small>DOSSIÊ DO COMANDANTE</small>
              <strong>FUNDOS</strong>
              <em>Defina a atmosfera visual do seu perfil</em>
              <b>ABRIR CATÁLOGO →</b>
            </span>
          </Link>

          <Link href="/profile/store/category/titles" className={styles.categoryCard}>
            <span className={styles.categoryVisual} data-category="titles">
              {quickTitle?.kind === "commander_title" ? (
                <ProfileTitleRenderer
                  title={{
                    id: quickTitle.id,
                    displayText: quickTitle.displayText,
                    rarity: quickTitle.rarity,
                    fontKey: quickTitle.fontKey,
                    styleKey: quickTitle.styleKey,
                    textureRef: quickTitle.textureRef,
                  }}
                  className={styles.categoryTitlePreview}
                />
              ) : (
                <span className={styles.categoryFallback}>TÍTULO</span>
              )}
            </span>
            <span className={styles.categoryCopy}>
              <small>IDENTIDADE DO COMANDANTE</small>
              <strong>TÍTULOS</strong>
              <em>Destaque sua presença no campo de comando</em>
              <b>ABRIR CATÁLOGO →</b>
            </span>
          </Link>
        </div>
      </section>

      <section
        id="store-credits"
        className={styles.treasury}
        data-store-zone="treasury"
        data-store-layer="04"
        aria-labelledby="treasury-title"
      >
        <span className={styles.lowerArmor} aria-hidden="true" />
        <span className={styles.treasuryCoin} aria-hidden="true">
          <Image src="/coin.svg" alt="" width={72} height={72} />
        </span>
        <div className={commerceStyles.treasuryIntro}>
          <small>TESOURARIA // CRÉDITOS DE CAMPANHA</small>
          <h2 id="treasury-title">Créditos</h2>
          <p>Adquira Créditos de Campanha para desbloquear itens da Intendência. A aquisição em moeda real permanece indisponível nesta versão.</p>
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
