"use client";

import { useMemo, useState } from "react";
import { TerritorySkinPreview } from "@/src/components/economy/territory-skin-preview";
import type {
  CosmeticCatalogItem,
  CosmeticSlot,
  EconomyStorefrontSnapshot,
} from "@/src/lib/economy/economy-contract";
import { cosmeticPreviewSource } from "@/src/lib/economy/cosmetic-preview";
import { ProfileCosmeticImage } from "./profile-cosmetic-image";
import styles from "./profile-arsenal.module.css";

const SLOT_META: Readonly<Record<CosmeticSlot, { label: string; code: string }>> = {
  dice_attack: { label: "Ataque", code: "ATK" },
  dice_defense: { label: "Defesa", code: "DEF" },
  dice_neutral: { label: "Neutro", code: "NTR" },
  territory_effect: { label: "Território", code: "TRT" },
};

const FILTERS: ReadonlyArray<{ id: "all" | CosmeticSlot; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "dice_attack", label: "Ataque" },
  { id: "dice_defense", label: "Defesa" },
  { id: "dice_neutral", label: "Neutro" },
  { id: "territory_effect", label: "Território" },
];

function CosmeticVisual({ item, priority = false }: { item: CosmeticCatalogItem; priority?: boolean }) {
  if (item.slot === "territory_effect") {
    return (
      <TerritorySkinPreview
        assetRef={cosmeticPreviewSource(item)}
        ariaLabel={`Prévia de ${item.name}`}
        className={styles.itemImage}
      />
    );
  }

  return (
    <ProfileCosmeticImage
      src={cosmeticPreviewSource(item)}
      alt={`Prévia de ${item.name}`}
      width={320}
      height={320}
      priority={priority}
      className={styles.itemImage}
      fallbackClassName={styles.visualFallback}
      fallbackLabel={SLOT_META[item.slot].code}
    />
  );
}

export function ProfileArsenal({ initialStorefront }: { initialStorefront: EconomyStorefrontSnapshot }) {
  const [storefront, setStorefront] = useState(initialStorefront);
  const [filter, setFilter] = useState<"all" | CosmeticSlot>("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialStorefront.ownedItems[0]?.id ?? null,
  );
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const visibleItems = useMemo(
    () => storefront.ownedItems.filter((item) => filter === "all" || item.slot === filter),
    [filter, storefront.ownedItems],
  );
  const selected =
    visibleItems.find((item) => item.id === selectedId) ?? visibleItems[0] ?? null;

  async function equip(item: CosmeticCatalogItem) {
    if (pending || item.status !== "available" || storefront.loadout[item.slot].id === item.id) return;

    setPending(item.id);
    setFeedback(null);
    try {
      const response = await fetch("/api/economy/loadout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: item.slot, cosmeticId: item.id }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { loadout?: EconomyStorefrontSnapshot["loadout"]; message?: string }
        | null;

      if (!response.ok || !payload?.loadout) {
        throw new Error(payload?.message ?? "Não foi possível equipar o cosmético.");
      }

      setStorefront((current) => ({ ...current, loadout: payload.loadout! }));
      setFeedback({ kind: "success", message: `${item.name} equipado em ${SLOT_META[item.slot].label}.` });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Falha ao atualizar o loadout.",
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={styles.arsenal} data-profile-v4-surface="arsenal">
      <header className={styles.hero}>
        <span>
          <small>ARSENAL // CONFIGURAÇÃO ATIVA</small>
          <h1>Equipamento do Comandante</h1>
          <p>Quatro posições independentes. Apenas cosméticos já pertencentes à conta podem ser equipados.</p>
        </span>
        <strong>{storefront.ownedItems.length.toString().padStart(2, "0")} ITENS</strong>
      </header>

      <section className={styles.bays} aria-labelledby="equipment-bays-title">
        <div className={styles.sectionHeading}>
          <span>
            <small>LOADOUT</small>
            <h2 id="equipment-bays-title">Equipment Bays</h2>
          </span>
          <em>4 / 4 POSIÇÕES</em>
        </div>
        <div className={styles.bayGrid}>
          {(Object.keys(SLOT_META) as CosmeticSlot[]).map((slot, index) => {
            const item = storefront.loadout[slot];
            return (
              <article key={slot} className={styles.bay} data-slot={slot}>
                <div className={styles.bayIndex}>{String(index + 1).padStart(2, "0")}</div>
                <div className={styles.bayVisual}>
                  <CosmeticVisual item={item} priority={index < 2} />
                </div>
                <div className={styles.bayCopy}>
                  <small>{SLOT_META[slot].label}</small>
                  <strong>{item.name}</strong>
                  <span>{item.isDefault ? "PADRÃO" : "EQUIPADO"}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.inventory} aria-labelledby="owned-inventory-title">
        <div className={styles.inventoryHeader}>
          <div className={styles.sectionHeading}>
            <span>
              <small>INVENTÁRIO AUTORIZADO</small>
              <h2 id="owned-inventory-title">Cosméticos possuídos</h2>
            </span>
          </div>
          <div className={styles.filters} role="group" aria-label="Filtrar cosméticos possuídos">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                data-active={filter === option.id ? "true" : "false"}
                aria-pressed={filter === option.id}
                onClick={() => {
                  setFilter(option.id);
                  setSelectedId(null);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.inventoryLayout}>
          <div className={styles.inventoryGrid}>
            {visibleItems.map((item) => {
              const equipped = storefront.loadout[item.slot].id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={styles.inventoryCard}
                  data-selected={selected?.id === item.id ? "true" : "false"}
                  data-equipped={equipped ? "true" : "false"}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className={styles.cardVisual}><CosmeticVisual item={item} /></span>
                  <span className={styles.cardCopy}>
                    <small>{SLOT_META[item.slot].label}</small>
                    <strong>{item.name}</strong>
                    <em>{equipped ? "EQUIPADO" : item.status === "retired" ? "ARQUIVADO" : "POSSUÍDO"}</em>
                  </span>
                </button>
              );
            })}
            {visibleItems.length === 0 ? (
              <div className={styles.emptyInventory}>
                <strong>Nenhum cosmético neste filtro</strong>
                <span>O Arsenal mostra somente itens efetivamente possuídos.</span>
              </div>
            ) : null}
          </div>

          <aside className={styles.inspector} aria-live="polite">
            {selected ? (
              <>
                <div className={styles.inspectorVisual}><CosmeticVisual item={selected} priority /></div>
                <div className={styles.inspectorCopy}>
                  <small>{SLOT_META[selected.slot].label}{" // "}{selected.rarity ?? "PADRÃO"}</small>
                  <h3>{selected.name}</h3>
                  <p>{selected.description ?? "Cosmético visual sem impacto nas regras da partida."}</p>
                  {storefront.loadout[selected.slot].id === selected.id ? (
                    <strong className={styles.equippedState}>EQUIPADO</strong>
                  ) : selected.status === "available" ? (
                    <button type="button" disabled={pending !== null} onClick={() => void equip(selected)}>
                      {pending === selected.id ? "EQUIPANDO…" : "EQUIPAR"}
                    </button>
                  ) : (
                    <strong className={styles.archivedState}>ARQUIVADO · POSSUÍDO</strong>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.emptyInspector}>Selecione um item possuído para inspecionar.</div>
            )}
          </aside>
        </div>
      </section>

      {feedback ? (
        <p className={styles.feedback} data-kind={feedback.kind} role={feedback.kind === "error" ? "alert" : "status"}>
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}