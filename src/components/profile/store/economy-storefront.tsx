"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type {
  CosmeticCatalogItem,
  CosmeticSlot,
  EconomyStorefrontSnapshot,
} from "@/src/lib/economy/economy-contract";
import styles from "./economy-storefront.module.css";

const SLOT_LABELS: Record<CosmeticSlot, string> = {
  dice_attack: "Ataque",
  dice_defense: "Defesa",
  dice_neutral: "Neutro",
  territory_effect: "Território",
};

function formatBalance(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function firstPreviewItem(items: ReadonlyArray<CosmeticCatalogItem>) {
  return items.find((item) => item.assetRef !== null) ?? null;
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

  return (
    <main className={styles.page} data-scene="profile">
      <header className={styles.header}>
        <div>
          <Link href="/profile" className={styles.back}>← Quartel</Link>
          <p>INTENDÊNCIA · ARSENAL COSMÉTICO</p>
          <h1>Remessas do Comando</h1>
          <span>
            Catálogo visual sem vantagem competitiva. Nesta fase, nenhuma compra ou recompensa está ativa.
          </span>
        </div>
        <div className={styles.wallet} data-currency={storefront.wallet.currency}>
          <small>{storefront.wallet.label}</small>
          <strong>
            <i aria-hidden="true">{storefront.wallet.symbol}</i>{" "}
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
                Itens já pertencentes à sua conta. Os quatro padrões permanecem disponíveis para restaurar qualquer slot.
              </p>
              <ul>
                {storefront.ownedItems.map((item) => {
                  const equipped = storefront.loadout[item.slot].id === item.id;
                  const canEquip = item.status === "available" && !equipped;
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
                        <em>{item.status === "retired" ? "ARQUIVADO" : "POSSUÍDO"}</em>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.catalog} aria-labelledby="catalog-title">
        <div className={styles.sectionHeading}>
          <span>NOVAS REMESSAS</span>
          <h2 id="catalog-title">Coleções anunciadas</h2>
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
                    <small>{set.status === "announced" ? "EM BREVE" : "DISPONÍVEL"}</small>
                    <h3>{set.name}</h3>
                  </div>
                  <p>{set.description}</p>
                  <ul>
                    {set.items.map((item) => {
                      const equipped = storefront.loadout[item.slot].id === item.id;
                      const canEquip = item.owned && item.status === "available" && !equipped;
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
                            <em>{item.owned ? "POSSUÍDO" : "EM BREVE"}</em>
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

      {feedback ? <p className={styles.feedback} role="status">{feedback}</p> : null}

      <footer className={styles.footer}>
        <span>ECONOMIA V1</span>
        <p>Sem checkout · sem preço fictício · sem moeda premium · sem alteração de gameplay.</p>
      </footer>
    </main>
  );
}
