"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ShowcasePurchaseError,
  purchaseShowcaseOffer,
} from "@/src/lib/client/store-showcase/purchase-showcase-offer";
import { TerritorySkinPreview } from "@/src/components/economy/territory-skin-preview";
import { ProfileTitleRenderer } from "@/src/components/profile/profile-title-renderer";
import { ProfileCosmeticImage } from "@/src/components/profile/v4/profile-cosmetic-image";
import type {
  BattlePassRewardPresentation,
  BattlePassSnapshot,
} from "@/src/lib/shared/progression/battle-pass-presentation";
import styles from "./battle-pass-page.module.css";

const INTEGER = new Intl.NumberFormat("pt-BR");
const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });

type ClaimFeedback = Readonly<{
  title: string;
  detail: string;
}>;

type ClaimReveal =
  | Readonly<{
      kind: "reward";
      reward: BattlePassRewardPresentation;
    }>
  | Readonly<{
      kind: "batch";
      claimedCount: number;
      creditAmount: number;
    }>;

function progressPercent(snapshot: BattlePassSnapshot) {
  const { xpTotal, currentLevelXp, nextLevelXp } = snapshot.progress;
  if (nextLevelXp === null) return 100;
  const span = Math.max(1, nextLevelXp - currentLevelXp);
  return Math.max(
    0,
    Math.min(100, ((xpTotal - currentLevelXp) / span) * 100),
  );
}

function stateLabel(reward: BattlePassRewardPresentation) {
  if (reward.state === "claimed") return "COLETADO";
  if (reward.state === "claimable") return "DISPONÍVEL";
  if (reward.state === "premium_locked") return "ELITE";
  return "BLOQUEADO";
}

function RewardVisual({ reward }: { reward: BattlePassRewardPresentation }) {
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

function RewardCard({
  reward,
  pending,
  onClaim,
}: {
  reward: BattlePassRewardPresentation;
  pending: boolean;
  onClaim: (reward: BattlePassRewardPresentation) => void;
}) {
  const interactive = reward.state === "claimable";

  return (
    <article
      className={styles.reward}
      data-state={pending ? "claiming" : reward.state}
      data-kind={reward.kind}
    >
      <span className={styles.rewardStatus}>
        {reward.state === "claimed" ? "✓ " : ""}
        {pending ? "COLETANDO..." : stateLabel(reward)}
      </span>
      <div className={styles.rewardVisual}>
        <RewardVisual reward={reward} />
      </div>
      <div className={styles.rewardCopy}>
        <strong>{reward.name}</strong>
        {reward.rarity ? <small>{reward.rarity.toUpperCase()}</small> : null}
      </div>
      {interactive ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => onClaim(reward)}
        >
          {pending ? "PROCESSANDO..." : "COLETAR"}
        </button>
      ) : reward.state === "premium_locked" ? (
        <span className={styles.rewardLock}>TRILHA DE ELITE</span>
      ) : reward.state === "locked" ? (
        <span className={styles.rewardLock}>NÍVEL {reward.level}</span>
      ) : (
        <span className={styles.rewardCollected}>✓ COLETADO</span>
      )}
    </article>
  );
}

export function BattlePassPage({
  snapshot,
  unavailable,
}: {
  snapshot: BattlePassSnapshot | null;
  unavailable: boolean;
}) {
  const router = useRouter();
  const [pendingRewardId, setPendingRewardId] = useState<string | null>(null);
  const [claimAllPending, setClaimAllPending] = useState(false);
  const [premiumPending, setPremiumPending] = useState(false);
  const [feedback, setFeedback] = useState<ClaimFeedback | null>(null);
  const [claimReveal, setClaimReveal] = useState<ClaimReveal | null>(null);
  const [railStart, setRailStart] = useState(0);

  const currentIndex = useMemo(() => {
    if (!snapshot) return 0;
    return Math.max(
      0,
      snapshot.levels.findIndex(
        (level) => level.level === snapshot.progress.levelReached,
      ),
    );
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot) return;
    const maxStart = Math.max(0, snapshot.levels.length - 8);
    setRailStart(
      Math.max(0, Math.min(maxStart, Math.max(0, currentIndex - 2))),
    );
  }, [currentIndex, snapshot]);

  async function claimReward(reward: BattlePassRewardPresentation) {
    if (pendingRewardId || claimAllPending) return;
    setPendingRewardId(reward.id);
    setFeedback(null);
    try {
      const response = await fetch("/api/battle-pass/rewards/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId: reward.id }),
      });
      if (!response.ok) throw new Error("claim_failed");
      setFeedback({
        title: "RECOMPENSA OBTIDA",
        detail: reward.name,
      });
      setClaimReveal({ kind: "reward", reward });
      router.refresh();
    } catch {
      setFeedback({
        title: "RECOMPENSA INDISPONÍVEL",
        detail: "Não foi possível confirmar a coleta agora.",
      });
    } finally {
      setPendingRewardId(null);
    }
  }

  async function claimAll() {
    if (!snapshot || pendingRewardId || claimAllPending) return;
    setClaimAllPending(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/battle-pass/rewards/claim-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId: snapshot.season.id }),
      });
      if (!response.ok) throw new Error("claim_all_failed");
      const result = (await response.json()) as {
        claimedCount?: number;
        creditAmount?: number;
      };
      const claimedCount = result.claimedCount ?? 0;
      const creditAmount = result.creditAmount ?? 0;
      setFeedback({
        title: "RECOMPENSAS RECEBIDAS",
        detail: `${INTEGER.format(claimedCount)} recompensas · +${INTEGER.format(creditAmount)} CR`,
      });
      setClaimReveal({
        kind: "batch",
        claimedCount,
        creditAmount,
      });
      router.refresh();
    } catch {
      setFeedback({
        title: "COLETA INDISPONÍVEL",
        detail: "As recompensas não puderam ser confirmadas agora.",
      });
    } finally {
      setClaimAllPending(false);
    }
  }

  async function activatePremium() {
    if (
      !snapshot ||
      snapshot.premium.access ||
      !snapshot.premium.offerId ||
      premiumPending
    ) {
      return;
    }

    setPremiumPending(true);
    setFeedback(null);
    try {
      await purchaseShowcaseOffer({
        offerId: snapshot.premium.offerId,
        expectedPrice: snapshot.premium.price,
      });
      setFeedback({
        title: "TRILHA DE ELITE ATIVADA",
        detail: "As recompensas Elite dos níveis já alcançados estão disponíveis.",
      });
      router.refresh();
    } catch (error) {
      const detail =
        error instanceof ShowcasePurchaseError
          ? error.code === "ECONOMY_INSUFFICIENT_BALANCE"
            ? "Créditos insuficientes para ativar a Trilha de Elite."
            : error.code === "ECONOMY_OFFER_ALREADY_OWNED"
              ? "A Trilha de Elite já pertence a este comandante."
              : error.message
          : "A Trilha de Elite não pôde ser ativada agora.";
      setFeedback({
        title: "ATIVAÇÃO NÃO CONCLUÍDA",
        detail,
      });
    } finally {
      setPremiumPending(false);
    }
  }

  if (unavailable) {
    return (
      <main className={styles.surface}>
        <header className={styles.utility}>
          <Link href="/home">← COMANDO</Link>
        </header>
        <section className={styles.empty}>
          <small>CAMPANHA // INDISPONÍVEL</small>
          <h1>Passe de Campanha</h1>
          <p>A progressão não pôde ser carregada agora.</p>
        </section>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className={styles.surface}>
        <header className={styles.utility}>
          <Link href="/home">← COMANDO</Link>
        </header>
        <section className={styles.empty}>
          <small>CAMPANHA // AGUARDANDO MOBILIZAÇÃO</small>
          <h1>Passe de Campanha</h1>
          <p>Nenhuma Campanha está ativa neste momento.</p>
        </section>
      </main>
    );
  }

  const percent = progressPercent(snapshot);
  const maxRailStart = Math.max(0, snapshot.levels.length - 8);
  const visibleLevels = snapshot.levels.slice(
    railStart,
    Math.min(snapshot.levels.length, railStart + 8),
  );

  function showCurrentLevel() {
    setRailStart(
      Math.max(0, Math.min(maxRailStart, Math.max(0, currentIndex - 2))),
    );
  }

  function showPreviousLevels() {
    setRailStart((current) => Math.max(0, current - 4));
  }

  function showNextLevels() {
    setRailStart((current) => Math.min(maxRailStart, current + 4));
  }

  return (
    <main className={styles.surface}>
      <header className={styles.utility}>
        <Link href="/home">← COMANDO</Link>
        <span>{INTEGER.format(snapshot.walletBalance)} CR</span>
      </header>

      <section className={styles.hero} aria-labelledby="campaign-title">
        <div className={styles.heroCopy}>
          <small>CAMPANHA // {snapshot.season.status.toUpperCase()}</small>
          <h1 id="campaign-title">{snapshot.season.name}</h1>
          {snapshot.season.description ? (
            <p>{snapshot.season.description}</p>
          ) : null}
          <div className={styles.progressHeader}>
            <span>
              NÍVEL <strong>{snapshot.progress.levelReached}</strong>
            </span>
            <span>{INTEGER.format(snapshot.progress.xpTotal)} XP</span>
          </div>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="Progresso para o próximo nível"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          <div className={styles.progressMeta}>
            {snapshot.progress.nextLevelXp === null ? (
              <span>NÍVEL MÁXIMO ALCANÇADO</span>
            ) : (
              <span>
                {INTEGER.format(snapshot.progress.xpToNextLevel)} XP PARA O
                PRÓXIMO NÍVEL
              </span>
            )}
            <span>
              ATÉ {DATE.format(new Date(snapshot.season.endsAt))}
            </span>
          </div>
        </div>

        <aside className={styles.premiumPanel}>
          <small>TRILHA DE ELITE</small>
          <strong>
            {snapshot.premium.access ? "ATIVA" : "3.000 CR"}
          </strong>
          {snapshot.premium.access ? (
            <span>Recompensas Elite liberadas pelo seu nível.</span>
          ) : (
            <>
              <span>
                Ative a trilha paga sem perder o progresso já conquistado.
              </span>
              <button
                type="button"
                disabled={
                  premiumPending ||
                  snapshot.premium.offerId === null ||
                  snapshot.walletBalance < snapshot.premium.price
                }
                onClick={() => void activatePremium()}
              >
                {premiumPending
                  ? "ATIVANDO..."
                  : snapshot.premium.offerId === null
                    ? "ELITE INDISPONÍVEL"
                    : snapshot.walletBalance < snapshot.premium.price
                      ? "CRÉDITOS INSUFICIENTES"
                      : "ATIVAR ELITE · 3.000 CR"}
              </button>
            </>
          )}
        </aside>
      </section>

      <section className={styles.rewardSection} aria-labelledby="rewards-title">
        <div className={styles.sectionHeader}>
          <div>
            <small>PROGRESSÃO // 100 NÍVEIS</small>
            <h2 id="rewards-title">Recompensas</h2>
          </div>
          {snapshot.claimableCount > 0 ? (
            <button
              type="button"
              className={styles.claimAll}
              disabled={claimAllPending || pendingRewardId !== null}
              onClick={() => void claimAll()}
            >
              {claimAllPending
                ? "COLETANDO..."
                : `COLETAR TODAS · ${snapshot.claimableCount}`}
            </button>
          ) : null}
        </div>

        {feedback ? (
          <div
            className={styles.feedback}
            role="status"
            aria-live="polite"
            data-feedback="true"
          >
            <strong>{feedback.title}</strong>
            <span>{feedback.detail}</span>
          </div>
        ) : null}

        <div className={styles.railControls}>
          <button
            type="button"
            onClick={showPreviousLevels}
            disabled={railStart === 0}
          >
            ← ANTERIORES
          </button>
          <button type="button" onClick={showCurrentLevel}>
            NÍVEL ATUAL
          </button>
          <button
            type="button"
            onClick={showNextLevels}
            disabled={railStart >= maxRailStart}
          >
            PRÓXIMOS →
          </button>
        </div>

        <div className={styles.trackLabels} aria-hidden="true">
          <span>TRILHA DE ELITE</span>
          <span>TRILHA LIVRE</span>
        </div>

        <div className={styles.levelRail}>
          {visibleLevels.map((level) => (
            <article
              key={level.level}
              className={styles.level}
              data-current={
                level.level === snapshot.progress.levelReached
                  ? "true"
                  : undefined
              }
            >
              <header>
                <span>NÍVEL</span>
                <strong>{level.level}</strong>
                {level.level === snapshot.progress.levelReached ? (
                  <small>ATUAL</small>
                ) : null}
              </header>

              <div className={styles.levelRewards} data-track="premium">
                {level.premiumRewards.length > 0 ? (
                  level.premiumRewards.map((reward) => (
                    <RewardCard
                      key={reward.id}
                      reward={reward}
                      pending={pendingRewardId === reward.id}
                      onClaim={(item) => void claimReward(item)}
                    />
                  ))
                ) : (
                  <span className={styles.noReward}>SEM RECOMPENSA</span>
                )}
              </div>

              <span className={styles.axisPoint} aria-hidden="true" />

              <div className={styles.levelRewards} data-track="free">
                {level.freeRewards.length > 0 ? (
                  level.freeRewards.map((reward) => (
                    <RewardCard
                      key={reward.id}
                      reward={reward}
                      pending={pendingRewardId === reward.id}
                      onClaim={(item) => void claimReward(item)}
                    />
                  ))
                ) : (
                  <span className={styles.noReward}>SEM RECOMPENSA</span>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className={styles.railHint}>
          <span>
            EXIBINDO NÍVEIS {visibleLevels[0]?.level ?? 1}–
            {visibleLevels.at(-1)?.level ?? 1}
          </span>
          <span>O NÍVEL ATUAL É PRIORIZADO AO ABRIR A CAMPANHA</span>
        </div>
      </section>

      {claimReveal ? (
        <div
          className={styles.rewardRevealBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Recompensa recebida"
        >
          <section className={styles.rewardRevealCard}>
            <small>RECOMPENSA RECEBIDA</small>
            {claimReveal.kind === "reward" ? (
              <>
                <div className={styles.rewardRevealVisual}>
                  <RewardVisual reward={claimReveal.reward} />
                </div>
                <strong>{claimReveal.reward.name}</strong>
                <span>
                  Nível {claimReveal.reward.level} ·{" "}
                  {claimReveal.reward.track === "premium"
                    ? "Trilha de Elite"
                    : "Trilha Livre"}
                </span>
              </>
            ) : (
              <>
                <div className={styles.rewardRevealBatch}>
                  <Image
                    src="/coin.svg"
                    alt=""
                    width={64}
                    height={64}
                    aria-hidden="true"
                  />
                  <strong>{INTEGER.format(claimReveal.claimedCount)}</strong>
                </div>
                <strong>Recompensas coletadas</strong>
                <span>
                  +{INTEGER.format(claimReveal.creditAmount)} CR nesta coleta
                </span>
              </>
            )}
            <button type="button" onClick={() => setClaimReveal(null)}>
              CONTINUAR
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
