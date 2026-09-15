"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type {
  CosmeticCatalogItem,
  CosmeticSlot,
  EconomyOffer,
  EconomyStorefrontSnapshot,
  PurchaseOfferResult,
} from "@/src/lib/economy/economy-contract";
import styles from "./economy-storefront.module.css";

const SLOT_LABELS: Record<CosmeticSlot, string> = {
  dice_attack: "Ataque",
  dice_defense: "Defesa",
  dice_neutral: "Neutro",
  territory_skin: "Território",
};

function formatBalance(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatBrl(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function firstPreviewItem(items: ReadonlyArray<CosmeticCatalogItem>) {
  return items.find((item) => item.assetRef !== null) ?? null;
}

function withPurchasedOwnership(
  item: CosmeticCatalogItem,
  acquiredIds: ReadonlySet<string>,
): CosmeticCatalogItem {
  return acquiredIds.has(item.id) ? { ...item, owned: true } : item;
}

function reconcilePurchase(
  current: EconomyStorefrontSnapshot,
  payload: PurchaseOfferResult,
): EconomyStorefrontSnapshot {
  const acquiredIds = new Set(payload.acquiredItems.map((item) => item.id));
  const ownedById = new Map(current.ownedItems.map((item) => [item.id, item]));
  for (const item of payload.acquiredItems) ownedById.set(item.id, item);

  const sets = current.sets.map((set) => ({
    ...set,
    items: set.items.map((item) => withPurchasedOwnership(item, acquiredIds)),
  }));

  const offers = current.offers.map((offer) => {
    const items = offer.items.map((item) => withPurchasedOwnership(item, acquiredIds));
    const derivedOwnedCount = items.filter((item) => item.owned).length;
    const ownedCount =
      offer.id === payload.offer.id ? payload.offer.ownedCount : derivedOwnedCount;
    const totalCount =
      offer.id === payload.offer.id ? payload.offer.totalCount : items.length;
    const fullyOwned =
      offer.id === payload.offer.id
        ? payload.offer.fullyOwned
        : totalCount > 0 && ownedCount === totalCount;

    return {
      ...offer,
      items,
      ownedCount,
      totalCount,
      fullyOwned,
      partiallyOwned: ownedCount > 0 && !fullyOwned,
      purchasable: offer.purchasable && !fullyOwned,
    };
  });

  return {
    ...current,
    wallet: payload.wallet,
    ownedItems: [...ownedById.values()],
    sets,
    offers,
  };
}

export function EconomyStorefront({
  initialStorefront,
}: {
  initialStorefront: EconomyStorefrontSnapshot;
}) {
  const [storefront, setStorefront] = useState(initialStorefront);
  const [pending, setPending] = useState<string | null>(null);
  const [previewSetId, setPreviewSetId] = useState<string | null>(null);
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function equip(item: CosmeticCatalogItem) {
    setPending(item.id);
    setFeedback(null);

    try {
      const response = await fetch("/api/economy/loadout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: item.slot, cosmeticId: item.id }),
      });
      const payload = (await response.json()) as {
        loadout?: EconomyStorefrontSnapshot["loadout"];
        message?: string;
      };

      if (!response.ok || !payload.loadout) {
        throw new Error(payload.message ?? "Não foi possível equipar o cosmético.");
      }

      setStorefront((current) => ({ ...current, loadout: payload.loadout! }));
      setFeedback(`${item.name} equipado em ${SLOT_LABELS[item.slot]}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao atualizar o loadout.");
    } finally {
      setPending(null);
    }
  }

  async function purchase(offer: EconomyOffer) {
    const idempotencyKey = crypto.randomUUID();
    const pendingKey = `purchase:${offer.id}`;
    setPending(pendingKey);
    setFeedback(null);

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
      const payload = (await response.json()) as Partial<PurchaseOfferResult> & {
        error?: string;
        message?: string;
        currentPrice?: number;
      };

      if (
        response.status === 409 &&
        payload.error === "ECONOMY_PRICE_CHANGED" &&
        typeof payload.currentPrice === "number" &&
        Number.isSafeInteger(payload.currentPrice) &&
        payload.currentPrice >= 0
      ) {
        setStorefront((current) => ({
          ...current,
          offers: current.offers.map((currentOffer) =>
            currentOffer.id === offer.id
              ? { ...currentOffer, price: payload.currentPrice! }
              : currentOffer,
          ),
        }));
        throw new Error(
          `O preço foi atualizado para ${formatBalance(payload.currentPrice)} créditos. Confirme novamente para comprar.`,
        );
      }

      if (
        !response.ok ||
        !payload.purchaseId ||
        !payload.wallet ||
        !payload.offer ||
        !Array.isArray(payload.acquiredItems)
      ) {
        throw new Error(payload.message ?? "Não foi possível concluir a compra.");
      }

      const confirmed = payload as PurchaseOfferResult;
      setStorefront((current) => reconcilePurchase(current, confirmed));

      const refreshedResponse = await fetch("/api/economy/storefront", {
        cache: "no-store",
      });
      if (refreshedResponse.ok) {
        const refreshed = (await refreshedResponse.json()) as EconomyStorefrontSnapshot;
        setStorefront(refreshed);
      }

      setFeedback(`${offer.name} adquirido. O inventário foi atualizado.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao concluir a compra.");
    } finally {
      setPending(null);
    }
  }

  return (
    <main className={styles.page} data-scene="profile">
      <header className={styles.header}>
        <div>
          <Link href="/profile" className={styles.back}>← Quartel</Link>
          <p>INTENDÊNCIA · ARSENAL COSMÉTICO</p>
          <h1>Remessas do Comando</h1>
          <span>
            Cosméticos são adquiridos com Créditos de Campanha e nunca alteram regras, RNG ou desempenho em batalha.
          </span>
        </div>
        <div className={styles.wallet} data-currency={storefront.wallet.currency}>
          <small>{storefront.wallet.label}</small>
          <strong>
            <Image
              src="/coin.svg"
              alt=""
              aria-hidden="true"
              width={24}
              height={24}
            />{" "}
            {formatBalance(storefront.wallet.balance)}
          </strong>
          <span>saldo persistente</span>
        </div>
      </header>

      <section className={styles.loadout} aria-labelledby="loadout-title">
        <div className={styles.sectionHeading}>
          <span>CONFIGURAÇÃO ATIVA</span>
          <h2 id="loadout-title">Loadout do comandante</h2>
        </div>
        <div className={styles.loadoutGrid}>
          {(Object.keys(SLOT_LABELS) as CosmeticSlot[]).map((slot) => {
            const item = storefront.loadout[slot];
            return (
              <article key={slot} className={styles.loadoutCard}>
                <small>{SLOT_LABELS[slot]}</small>
                <strong>{item.name}</strong>
                <span>{item.isDefault ? "PADRÃO" : "EQUIPADO"}</span>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.catalog} aria-labelledby="owned-title">
        <div className={styles.sectionHeading}>
          <span>SEU EQUIPAMENTO</span>
          <h2 id="owned-title">Arsenal possuído</h2>
        </div>
        <div className={styles.setGrid}>
          <article className={styles.setCard} data-status="available">
            <div className={styles.setVisual} aria-hidden="true">
              <span>✓</span>
              <i>{storefront.ownedItems.length}</i>
            </div>
            <div className={styles.setCopy}>
              <div>
                <small>DISPONÍVEL</small>
                <h3>Equipamento do comandante</h3>
              </div>
              <p>
                Itens pertencentes à sua conta. Cada slot pode ser configurado de forma independente.
              </p>
              <ul>
                {storefront.ownedItems.map((item) => {
                  const equipped = storefront.loadout[item.slot].id === item.id;
                  const canEquip =
                    (item.status === "available" || item.status === "retired") &&
                    !equipped;
                  return (
                    <li key={item.id}>
                      <span>
                        <small>{SLOT_LABELS[item.slot]}</small>
                        <strong>{item.name}</strong>
                      </span>
                      {equipped ? (
                        <em>EQUIPADO</em>
                      ) : canEquip ? (
                        <button
                          type="button"
                          onClick={() => equip(item)}
                          disabled={pending !== null}
                        >
                          {pending === item.id ? "EQUIPANDO…" : "EQUIPAR"}
                        </button>
                      ) : (
                        <em>POSSUÍDO</em>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.catalog} aria-labelledby="offers-title">
        <div className={styles.sectionHeading}>
          <span>OFERTAS ATIVAS</span>
          <h2 id="offers-title">Aquisições disponíveis</h2>
        </div>
        <div className={styles.setGrid}>
          {storefront.offers.map((offer) => {
            const purchasePending = pending === `purchase:${offer.id}`;
            const insufficientBalance = storefront.wallet.balance < offer.price;
            const purchaseDisabled =
              pending !== null ||
              !offer.purchasable ||
              offer.fullyOwned ||
              insufficientBalance;

            return (
              <article key={offer.id} className={styles.setCard} data-status={offer.status}>
                <div className={styles.setVisual} aria-hidden="true">
                  <span>{offer.featured ? "★" : "OFERTA"}</span>
                  <i>{offer.totalCount}</i>
                </div>
                <div className={styles.setCopy}>
                  <div>
                    <small>{offer.featured ? "DESTAQUE" : "DISPONÍVEL"}</small>
                    <h3>{offer.name}</h3>
                  </div>
                  <p>{offer.description}</p>
                  <ul>
                    {offer.items.map((item) => {
                      const equipped = storefront.loadout[item.slot].id === item.id;
                      const canEquip =
                        item.owned &&
                        (item.status === "available" || item.status === "retired") &&
                        !equipped;
                      return (
                        <li key={item.id}>
                          <span>
                            <small>{SLOT_LABELS[item.slot]}</small>
                            <strong>{item.name}</strong>
                          </span>
                          {equipped ? (
                            <em>EQUIPADO</em>
                          ) : canEquip ? (
                            <button
                              type="button"
                              onClick={() => equip(item)}
                              disabled={pending !== null}
                            >
                              {pending === item.id ? "EQUIPANDO…" : "EQUIPAR"}
                            </button>
                          ) : item.owned ? (
                            <em>POSSUÍDO</em>
                          ) : (
                            <em>INCLUSO</em>
                          )}
                        </li>
                      );
                    })}
                    <li>
                      <span>
                        <small>PROGRESSO</small>
                        <strong>
                          {offer.ownedCount}/{offer.totalCount} possuído
                          {offer.partiallyOwned ? " · preço de conclusão" : ""}
                        </strong>
                      </span>
                      <em>{offer.fullyOwned ? "POSSUÍDO" : ""}</em>
                    </li>
                    <li>
                      <span>
                        <small>VALOR</small>
                        <strong>
                          <Image
                            src="/coin.svg"
                            alt=""
                            aria-hidden="true"
                            width={20}
                            height={20}
                          />{" "}
                          {formatBalance(offer.price)}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => purchase(offer)}
                        disabled={purchaseDisabled}
                      >
                        {offer.fullyOwned
                          ? "POSSUÍDO"
                          : !offer.purchasable
                            ? "INDISPONÍVEL"
                            : purchasePending
                              ? "PROCESSANDO…"
                              : offer.partiallyOwned
                                ? "COMPLETAR"
                                : "COMPRAR"}
                      </button>
                    </li>
                  </ul>
                  {!offer.purchasable && !offer.fullyOwned ? (
                    <small>Esta oferta está temporariamente indisponível.</small>
                  ) : insufficientBalance && !offer.fullyOwned ? (
                    <small>Saldo insuficiente para esta oferta.</small>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.catalog} aria-labelledby="catalog-title">
        <div className={styles.sectionHeading}>
          <span>CATÁLOGO VISUAL</span>
          <h2 id="catalog-title">Coleções e prévias</h2>
        </div>

        <div className={styles.setGrid}>
          {storefront.sets.map((set) => {
            const previewOpen = previewSetId === set.id;
            const selectedPreviewItem = previewOpen
              ? set.items.find(
                  (item) => item.id === previewItemId && item.assetRef !== null,
                ) ?? firstPreviewItem(set.items)
              : null;
            const previewPanelId = `preview-${set.slug}`;

            return (
              <article key={set.id} className={styles.setCard} data-status={set.status}>
                <div className={styles.setVisual} aria-hidden="true">
                  <span>D6</span>
                  <i>{set.items.length}</i>
                </div>
                <div className={styles.setCopy}>
                  <div>
                    <small>{set.status === "announced" ? "EM BREVE" : "CATÁLOGO"}</small>
                    <h3>{set.name}</h3>
                  </div>
                  <p>{set.description}</p>
                  <ul>
                    {set.items.map((item) => {
                      const equipped = storefront.loadout[item.slot].id === item.id;
                      const canEquip =
                        item.owned &&
                        (item.status === "available" || item.status === "retired") &&
                        !equipped;
                      return (
                        <li key={item.id}>
                          <span>
                            <small>{SLOT_LABELS[item.slot]}</small>
                            <strong>{item.name}</strong>
                          </span>
                          {equipped ? (
                            <em>EQUIPADO</em>
                          ) : canEquip ? (
                            <button
                              type="button"
                              onClick={() => equip(item)}
                              disabled={pending !== null}
                            >
                              {pending === item.id ? "EQUIPANDO…" : "EQUIPAR"}
                            </button>
                          ) : (
                            <em>{item.owned ? "POSSUÍDO" : "CATÁLOGO"}</em>
                          )}
                        </li>
                      );
                    })}
                    <li>
                      <span>
                        <small>PRÉVIA</small>
                        <strong>Inspecionar remessa</strong>
                      </span>
                      <button
                        type="button"
                        aria-expanded={previewOpen}
                        aria-controls={previewPanelId}
                        onClick={() => {
                          if (previewOpen) {
                            setPreviewSetId(null);
                            setPreviewItemId(null);
                            return;
                          }

                          setPreviewSetId(set.id);
                          setPreviewItemId(firstPreviewItem(set.items)?.id ?? null);
                        }}
                      >
                        {previewOpen ? "FECHAR" : "INSPECIONAR"}
                      </button>
                    </li>
                  </ul>

                  {previewOpen ? (
                    <div
                      id={previewPanelId}
                      className={styles.previewDetail}
                      data-preview-detail
                    >
                      <div className={styles.previewHeading}>
                        <span>
                          <small>PRÉVIA DETALHADA</small>
                          <strong>{set.name}</strong>
                        </span>
                        <em>HQ SOB DEMANDA · SEM AQUISIÇÃO</em>
                      </div>

                      <div
                        className={styles.previewToolbar}
                        role="group"
                        aria-label={`Selecionar dado da remessa ${set.name}`}
                      >
                        {set.items
                          .filter((item) => item.assetRef !== null)
                          .map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              data-active={selectedPreviewItem?.id === item.id ? "true" : "false"}
                              aria-pressed={selectedPreviewItem?.id === item.id}
                              onClick={() => setPreviewItemId(item.id)}
                            >
                              {SLOT_LABELS[item.slot]}
                            </button>
                          ))}
                      </div>

                      <div className={styles.previewStage} data-preview-stage>
                        {selectedPreviewItem?.assetRef ? (
                          <Image
                            src={selectedPreviewItem.assetRef}
                            alt={`${set.name} — dado de ${SLOT_LABELS[selectedPreviewItem.slot].toLowerCase()}`}
                            width={320}
                            height={320}
                            loading="lazy"
                            unoptimized
                            className={styles.previewImage}
                          />
                        ) : (
                          <span>PRÉVIA INDISPONÍVEL</span>
                        )}
                      </div>

                      {selectedPreviewItem ? (
                        <div className={styles.previewMeta}>
                          <small>{SLOT_LABELS[selectedPreviewItem.slot]}</small>
                          <strong>{selectedPreviewItem.name}</strong>
                          <span>Somente visual · regras, RNG e física permanecem inalterados.</span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.catalog} aria-labelledby="credits-title">
        <div className={styles.sectionHeading}>
          <span>CRÉDITOS DE CAMPANHA</span>
          <h2 id="credits-title">Reforços de saldo</h2>
        </div>
        <div className={styles.setGrid}>
          {storefront.creditPacks.map((pack) => (
            <article key={pack.id} className={styles.setCard} data-status={pack.status}>
              <div className={styles.setVisual} aria-hidden="true">
                <span>CR</span>
                <i>{formatBalance(pack.creditAmount)}</i>
              </div>
              <div className={styles.setCopy}>
                <div>
                  <small>EM BREVE</small>
                  <h3>{pack.name}</h3>
                </div>
                <p>Pacote demonstrativo. Aquisição por moeda real não está habilitada.</p>
                <ul>
                  <li>
                    <span>
                      <small>CRÉDITOS</small>
                      <strong>
                        <Image
                          src="/coin.svg"
                          alt=""
                          aria-hidden="true"
                          width={20}
                          height={20}
                        />{" "}
                        {formatBalance(pack.creditAmount)}
                      </strong>
                    </span>
                    <em>{formatBrl(pack.priceBrlCents)}</em>
                  </li>
                  <li>
                    <span>
                      <small>STATUS</small>
                      <strong>Disponibilidade futura</strong>
                    </span>
                    <button type="button" disabled>EM BREVE</button>
                  </li>
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      {feedback ? <p className={styles.feedback} role="status">{feedback}</p> : null}

      <footer className={styles.footer}>
        <span>ECONOMIA V2</span>
        <p>Créditos de Campanha · cosméticos individuais · sem vantagem competitiva.</p>
      </footer>
    </main>
  );
}
