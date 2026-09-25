"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CosmeticCatalogItem, EconomyOffer } from "@/src/lib/economy/economy-contract";
import type {
  ProfileAppearanceStoreItem,
  ProfileAppearanceStoreOffer,
  ProfileAppearanceStorefront,
} from "@/src/lib/economy/profile-appearance-store-contract";
import { cosmeticPreviewSource } from "@/src/lib/economy/cosmetic-preview";
import {
  STORE_CATEGORY_IDS,
  STORE_CATEGORY_META,
  type StoreCategoryId,
} from "@/src/lib/economy/store-category-contract";
import {
  ShowcasePurchaseError,
  purchaseShowcaseOffer,
} from "@/src/lib/client/store-showcase/purchase-showcase-offer";
import { ProfileTitleRenderer } from "@/src/components/profile/profile-title-renderer";
import { TerritorySkinPreview } from "@/src/components/economy/territory-skin-preview";
import styles from "./profile-store-category.module.css";

const INTEGER_FORMAT = new Intl.NumberFormat("pt-BR");

function ownershipLabel(owned: boolean, fullyOwned: boolean) {
  return owned || fullyOwned ? "POSSUÍDO" : "DISPONÍVEL";
}

function purchaseErrorMessage(error: ShowcasePurchaseError) {
  if (error.code === "ECONOMY_PRICE_CHANGED") {
    return error.currentPrice === null
      ? "O preço mudou. Atualize a Intendência antes de tentar novamente."
      : `O preço mudou para ${INTEGER_FORMAT.format(error.currentPrice)} créditos.`;
  }
  if (error.code === "ECONOMY_INSUFFICIENT_BALANCE") return "Créditos insuficientes para concluir esta compra.";
  if (error.code === "ECONOMY_OFFER_ALREADY_OWNED") return "Este conteúdo já pertence ao seu Arsenal.";
  return error.retryable ? "Não foi possível confirmar a compra. Tente novamente." : error.message;
}

function isDiceOffer(offer: EconomyOffer) {
  return (
    offer.items.length > 0 &&
    offer.items.every(
      (item) =>
        item.slot === "dice_attack" ||
        item.slot === "dice_defense" ||
        item.slot === "dice_neutral",
    )
  );
}

function titleAppearance(item: Extract<ProfileAppearanceStoreItem, { kind: "commander_title" }>) {
  return {
    id: item.id,
    displayText: item.displayText,
    rarity: item.rarity,
    fontKey: item.fontKey,
    styleKey: item.styleKey,
    textureRef: item.textureRef,
  };
}

export function ProfileStoreCategory({
  category,
  gameplayOffers,
  territorySkins,
  appearanceStorefront,
}: {
  category: StoreCategoryId;
  gameplayOffers: ReadonlyArray<EconomyOffer>;
  territorySkins: ReadonlyArray<CosmeticCatalogItem>;
  appearanceStorefront: ProfileAppearanceStorefront;
}) {
  const router = useRouter();
  const [pendingOfferId, setPendingOfferId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const meta = STORE_CATEGORY_META[category];

  const diceOffers = useMemo(
    () => gameplayOffers.filter(isDiceOffer),
    [gameplayOffers],
  );

  const territoryEntries = useMemo(() => {
    const byCosmeticId = new Map<string, EconomyOffer>();
    for (const offer of gameplayOffers) {
      if (offer.items.length !== 1) continue;
      const item = offer.items[0];
      if (item?.slot === "territory_skin") byCosmeticId.set(item.id, offer);
    }
    return territorySkins.map((item) => ({
      item,
      offer: byCosmeticId.get(item.id) ?? null,
    }));
  }, [gameplayOffers, territorySkins]);

  const appearanceOffers = useMemo(
    () =>
      appearanceStorefront.offers.filter(
        (offer) =>
          offer.items.length > 0 &&
          offer.items.every((item) =>
            category === "backgrounds"
              ? item.kind === "profile_background"
              : item.kind === "commander_title",
          ),
      ),
    [appearanceStorefront.offers, category],
  );

  async function handlePurchase(offer: EconomyOffer | ProfileAppearanceStoreOffer) {
    if (offer.fullyOwned || !offer.purchasable || pendingOfferId !== null) return;
    setPendingOfferId(offer.id);
    setMessage(null);
    try {
      await purchaseShowcaseOffer({ offerId: offer.id, expectedPrice: offer.price });
      setMessage({ kind: "success", text: `Compra de ${offer.name} confirmada.` });
      router.refresh();
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof ShowcasePurchaseError ? purchaseErrorMessage(error) : "A compra não pôde ser confirmada agora.",
      });
    } finally {
      setPendingOfferId(null);
    }
  }

  return (
    <div className={styles.categoryPage}>
      <div className={styles.atmosphere} aria-hidden="true">
        <span />
        <span />
      </div>

      <header className={styles.categoryHeader}>
        <div className={styles.categoryUtility}>
          <Link href="/profile/store" className={styles.backLink}>← INTENDÊNCIA</Link>
        </div>
        <small>{meta.kicker}</small>
        <h1>{meta.label}</h1>
        <p>{meta.description}</p>
      </header>

      <nav className={styles.categoryNav} aria-label="Guia rápido de categorias">
        {STORE_CATEGORY_IDS.map((id) => (
          <Link
            key={id}
            href={`/profile/store/category/${id}`}
            data-active={category === id ? "true" : undefined}
            aria-current={category === id ? "page" : undefined}
          >
            {STORE_CATEGORY_META[id].label.toUpperCase()}
          </Link>
        ))}
      </nav>

      {message ? (
        <div className={styles.feedback} data-kind={message.kind} role="status" aria-live="polite">
          {message.text}
        </div>
      ) : null}

      <section className={styles.catalog} aria-label={`Catálogo de ${meta.label}`}>
        {category === "dice"
          ? diceOffers.map((offer) => {
              const item = offer.items.find((candidate) => cosmeticPreviewSource(candidate) !== null) ?? offer.items[0];
              return (
                <article key={offer.id} className={styles.product}>
                  <Link href={`/profile/store/showcase/offer/${encodeURIComponent(offer.id)}`} className={styles.visual}>
                    {item ? (
                      <Image
                        src={cosmeticPreviewSource(item) ?? "/coin.svg"}
                        alt={`Prévia de ${offer.name}`}
                        width={320}
                        height={260}
                      />
                    ) : null}
                  </Link>
                  <div className={styles.copy}>
                    <small>{ownershipLabel(false, offer.fullyOwned)}</small>
                    <strong>{offer.name}</strong>
                    <span>{offer.items.length > 1 ? `${offer.items.length} itens` : "Item individual"}</span>
                  </div>
                  <div className={styles.commerce}>
                    <span><Image src="/coin.svg" alt="" width={19} height={19} />{INTEGER_FORMAT.format(offer.price)}</span>
                    <button
                      disabled={
                        offer.fullyOwned ||
                        !offer.purchasable ||
                        pendingOfferId !== null
                      }
                      onClick={() => void handlePurchase(offer)}
                    >
                      {offer.fullyOwned
                        ? "POSSUÍDO"
                        : collectionLocked
                          ? "BLOQUEADO"
                          : pendingOfferId === offer.id
                            ? "PROCESSANDO..."
                            : "COMPRAR"}
                    </button>
                  </div>
                </article>
              );
            })
          : null}

        {category === "territories"
          ? territoryEntries.map(({ item, offer }) => (
              <article key={item.id} className={styles.product}>
                {offer ? (
                  <Link href={`/profile/store/showcase/offer/${encodeURIComponent(offer.id)}?item=${encodeURIComponent(item.id)}`} className={styles.visual}>
                    <TerritorySkinPreview assetRef={cosmeticPreviewSource(item)} ariaLabel={`Prévia de ${item.name}`} />
                  </Link>
                ) : (
                  <div className={styles.visual}>
                    <TerritorySkinPreview assetRef={cosmeticPreviewSource(item)} ariaLabel={`Prévia de ${item.name}`} />
                  </div>
                )}
                <div className={styles.copy}>
                  <small>{item.owned ? "POSSUÍDO" : offer ? "DISPONÍVEL" : "ANUNCIADO"}</small>
                  <strong>{item.name}</strong>
                  <span>{item.equipped ? "Equipado" : "Acabamento territorial"}</span>
                </div>
                {offer ? (
                  <div className={styles.commerce}>
                    <span><Image src="/coin.svg" alt="" width={19} height={19} />{INTEGER_FORMAT.format(offer.price)}</span>
                    <button disabled={offer.fullyOwned || !offer.purchasable || pendingOfferId !== null} onClick={() => void handlePurchase(offer)}>
                      {offer.fullyOwned ? "POSSUÍDO" : pendingOfferId === offer.id ? "PROCESSANDO..." : "COMPRAR"}
                    </button>
                  </div>
                ) : null}
              </article>
            ))
          : null}

        {category === "backgrounds" || category === "titles"
          ? appearanceOffers.map((offer) => {
              const item = offer.items.find((candidate) =>
                category === "backgrounds" ? candidate.kind === "profile_background" : candidate.kind === "commander_title",
              );
              if (!item) return null;
              const collectionUnlock =
                item.kind === "profile_background"
                  ? item.collectionUnlock
                  : null;
              const collectionLocked =
                Boolean(collectionUnlock && !collectionUnlock.complete) &&
                !item.owned;

              return (
                <article
                  key={offer.id}
                  className={styles.product}
                  data-collection-locked={collectionLocked ? "true" : undefined}
                >
                  <div className={styles.visual} data-appearance-kind={item.kind}>
                    {item.kind === "profile_background" ? (
                      <Image src={item.previewRef ?? item.assetRef} alt={`Prévia de ${item.name}`} width={520} height={300} />
                    ) : (
                      <ProfileTitleRenderer title={titleAppearance(item)} className={styles.titlePreview} />
                    )}
                  </div>
                  <div className={styles.copy}>
                    <small>{ownershipLabel(item.owned, offer.fullyOwned)}</small>
                    <strong>{item.name}</strong>
                    <span>{item.description ?? (item.kind === "profile_background" ? "Fundo de Dossiê" : "Título de comandante")}</span>
                    {collectionUnlock ? (
                      <div
                        className={styles.collectionProgress}
                        data-complete={collectionUnlock.complete ? "true" : "false"}
                        aria-label={`${collectionUnlock.ownedCount} de ${collectionUnlock.totalCount} itens da coleção ${collectionUnlock.collectionName} possuídos`}
                      >
                        <small>{collectionUnlock.collectionName.toUpperCase()}</small>
                        <b>
                          {collectionUnlock.ownedCount}/{collectionUnlock.totalCount} ITENS
                        </b>
                      </div>
                    ) : null}
                  </div>
                  <div className={styles.commerce}>
                    <span><Image src="/coin.svg" alt="" width={19} height={19} />{INTEGER_FORMAT.format(offer.price)}</span>
                    <button disabled={offer.fullyOwned || !offer.purchasable || pendingOfferId !== null} onClick={() => void handlePurchase(offer)}>
                      {offer.fullyOwned ? "POSSUÍDO" : pendingOfferId === offer.id ? "PROCESSANDO..." : "COMPRAR"}
                    </button>
                  </div>
                </article>
              );
            })
          : null}
      </section>

      {((category === "dice" && diceOffers.length === 0) ||
        (category === "territories" && territoryEntries.length === 0) ||
        ((category === "backgrounds" || category === "titles") && appearanceOffers.length === 0)) ? (
        <div className={styles.empty}>
          <strong>Nenhum item disponível nesta categoria</strong>
          <span>Novas remessas aparecerão aqui quando entrarem no catálogo.</span>
        </div>
      ) : null}
    </div>
  );
}
