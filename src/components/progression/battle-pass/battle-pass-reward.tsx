"use client";

import Image from "next/image";
import { TerritorySkinPreview } from "@/src/components/economy/territory-skin-preview";
import { ProfileTitleRenderer } from "@/src/components/profile/profile-title-renderer";
import { ProfileCosmeticImage } from "@/src/components/profile/v4/profile-cosmetic-image";
import type { BattlePassRewardPresentation } from "@/src/lib/shared/progression/battle-pass-presentation";
import styles from "./battle-pass-reward.module.css";

const INTEGER = new Intl.NumberFormat("pt-BR");

export function groupBattlePassRewards(
  rewards: ReadonlyArray<BattlePassRewardPresentation>,
) {
  const groups = new Map<
    string,
    {
      presentationGroupKey: string | null;
      rewards: BattlePassRewardPresentation[];
    }
  >();

  for (const reward of rewards) {
    const mapKey = reward.presentationGroupKey
      ? `group:${reward.presentationGroupKey}`
      : `reward:${reward.id}`;
    const current = groups.get(mapKey);
    if (current) current.rewards.push(reward);
    else {
      groups.set(mapKey, {
        presentationGroupKey: reward.presentationGroupKey,
        rewards: [reward],
      });
    }
  }

  return [...groups.values()];
}

function stateLabel(reward: BattlePassRewardPresentation) {
  if (reward.state === "claimed") return "COLETADO";
  if (reward.state === "claimable") return "DISPONÍVEL";
  if (reward.state === "premium_locked") return "ELITE";
  return "BLOQUEADO";
}

function groupState(rewards: ReadonlyArray<BattlePassRewardPresentation>) {
  if (rewards.every((reward) => reward.state === "claimed")) return "claimed";
  if (rewards.some((reward) => reward.state === "claimable")) return "claimable";
  if (rewards.some((reward) => reward.state === "premium_locked")) {
    return "premium_locked";
  }
  return "locked";
}

export function BattlePassRewardVisual({
  reward,
}: {
  reward: BattlePassRewardPresentation;
}) {
  if (reward.kind === "campaign_credit") {
    return (
      <span className={styles.creditVisual}>
        <Image src="/coin.svg" alt="" width={42} height={42} aria-hidden="true" />
        <strong>{INTEGER.format(reward.creditAmount ?? 0)}</strong>
        <small>CR</small>
      </span>
    );
  }

  if (reward.kind === "commander_title" && reward.title) {
    return (
      <span className={styles.titleVisual}>
        <ProfileTitleRenderer
          title={{
            id: reward.itemId ?? reward.id,
            displayText: reward.title.displayText,
            rarity: reward.title.rarity,
            fontKey: reward.title.fontKey,
            styleKey: reward.title.styleKey,
            textureRef: reward.title.textureRef,
          }}
        />
      </span>
    );
  }

  if (reward.slot === "territory_skin") {
    return (
      <TerritorySkinPreview
        assetRef={reward.previewRef}
        className={styles.territoryVisual}
        ariaLabel={`Prévia de ${reward.name}`}
      />
    );
  }

  return (
    <ProfileCosmeticImage
      src={reward.previewRef}
      alt={reward.name}
      width={240}
      height={180}
      className={styles.rewardImage}
      fallbackClassName={styles.rewardFallback}
      fallbackLabel={reward.kind === "profile_background" ? "FUNDO" : "ITEM"}
    />
  );
}

export function BattlePassReward({
  reward,
  pending,
  onClaim,
}: {
  reward: BattlePassRewardPresentation;
  pending: boolean;
  onClaim: (reward: BattlePassRewardPresentation) => void;
}) {
  const interactive = reward.state === "claimable";
  const state = pending ? "claiming" : reward.state;

  return (
    <article className={styles.rewardItem} data-state={state} data-kind={reward.kind}>
      <span className={styles.rewardStatus}>
        {reward.state === "claimed" ? "✓ " : ""}
        {pending ? "COLETANDO..." : stateLabel(reward)}
      </span>
      <div className={styles.rewardVisual}>
        <BattlePassRewardVisual reward={reward} />
      </div>
      <div className={styles.rewardCopy}>
        <strong title={reward.name}>{reward.name}</strong>
        {reward.rarity ? <small>{reward.rarity.toUpperCase()}</small> : null}
      </div>
      {interactive ? (
        <button type="button" disabled={pending} onClick={() => onClaim(reward)}>
          {pending ? "PROCESSANDO..." : "COLETAR"}
        </button>
      ) : reward.state === "premium_locked" ? (
        <span className={styles.rewardStateText}>TRILHA DE ELITE</span>
      ) : reward.state === "locked" ? (
        <span className={styles.rewardStateText}>NÍVEL {reward.level}</span>
      ) : (
        <span className={styles.rewardStateText}>✓ COLETADO</span>
      )}
    </article>
  );
}

export function BattlePassRewardGroup({
  rewards,
  pending,
  onClaim,
}: {
  rewards: ReadonlyArray<BattlePassRewardPresentation>;
  pending: boolean;
  onClaim: (rewards: ReadonlyArray<BattlePassRewardPresentation>) => void;
}) {
  const state = groupState(rewards);
  const anchor = rewards[0];
  if (!anchor) return null;

  return (
    <article className={styles.rewardItem} data-state={pending ? "claiming" : state}>
      <span className={styles.rewardStatus}>
        {state === "claimed" ? "✓ " : ""}
        {pending
          ? "COLETANDO..."
          : state === "claimed"
            ? "COLETADO"
            : state === "claimable"
              ? "CONJUNTO DISPONÍVEL"
              : state === "premium_locked"
                ? "ELITE"
                : "BLOQUEADO"}
      </span>
      <div className={styles.rewardGroupVisuals}>
        {rewards.map((reward) => (
          <div key={reward.id} className={styles.rewardGroupVisual}>
            <BattlePassRewardVisual reward={reward} />
          </div>
        ))}
      </div>
      <div className={styles.rewardCopy}>
        <strong>Conjunto Inicial de Elite</strong>
        <small>{rewards.length} ITENS</small>
      </div>
      {state === "claimable" ? (
        <button type="button" disabled={pending} onClick={() => onClaim(rewards)}>
          {pending ? "PROCESSANDO..." : "COLETAR CONJUNTO"}
        </button>
      ) : state === "premium_locked" ? (
        <span className={styles.rewardStateText}>TRILHA DE ELITE</span>
      ) : state === "locked" ? (
        <span className={styles.rewardStateText}>NÍVEL {anchor.level}</span>
      ) : (
        <span className={styles.rewardStateText}>✓ CONJUNTO COLETADO</span>
      )}
    </article>
  );
}
