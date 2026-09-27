"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
      kind: "group";
      rewards: ReadonlyArray<BattlePassRewardPresentation>;
      claimedCount: number;
      alreadyClaimedCount: number;
    }>
  | Readonly<{
      kind: "batch";
      claimedCount: number;
      alreadyClaimedCount: number;
      creditAmount: number;
      gameCosmeticCount: number;
      titleCount: number;
      backgroundCount: number;
      level100Titles: ReadonlyArray<
        Readonly<{ name: string; track: "free" | "premium" }>
      >;
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

function groupedRewards(
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
    if (current) {
      current.rewards.push(reward);
    } else {
      groups.set(mapKey, {
        presentationGroupKey: reward.presentationGroupKey,
        rewards: [reward],
      });
    }
  }

  return [...groups.values()];
}

function groupState(rewards: ReadonlyArray<BattlePassRewardPresentation>) {
  if (rewards.every((reward) => reward.state === "claimed")) return "claimed";
  if (rewards.some((reward) => reward.state === "claimable")) return "claimable";
  if (rewards.some((reward) => reward.state === "premium_locked")) {
    return "premium_locked";
  }
  return "locked";
}

function initialRailStart(snapshot: BattlePassSnapshot | null) {
  if (!snapshot) return 0;
  const currentIndex = Math.max(
    0,
    snapshot.levels.findIndex(
      (level) => level.level === snapshot.progress.levelReached,
    ),
  );
  const maxStart = Math.max(0, snapshot.levels.length - 8);
  return Math.max(0, Math.min(maxStart, Math.max(0, currentIndex - 2)));
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

function RewardGroupCard({
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
    <article
      className={styles.rewardGroup}
      data-state={pending ? "claiming" : state}
    >
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
            <RewardVisual reward={reward} />
          </div>
        ))}
      </div>
      <div className={styles.rewardCopy}>
        <strong>Conjunto Inicial de Elite</strong>
        <small>{rewards.length} ITENS</small>
      </div>
      {state === "claimable" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => onClaim(rewards)}
        >
          {pending ? "PROCESSANDO..." : "COLETAR CONJUNTO"}
        </button>
      ) : state === "premium_locked" ? (
        <span className={styles.rewardLock}>TRILHA DE ELITE</span>
      ) : state === "locked" ? (
        <span className={styles.rewardLock}>NÍVEL {anchor.level}</span>
      ) : (
        <span className={styles.rewardCollected}>✓ CONJUNTO COLETADO</span>
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
  const [premiumConfirmationOpen, setPremiumConfirmationOpen] = useState(false);
  const [feedback, setFeedback] = useState<ClaimFeedback | null>(null);
  const [claimReveal, setClaimReveal] = useState<ClaimReveal | null>(null);
  const [railStart, setRailStart] = useState(() => initialRailStart(snapshot));
  const rewardDialogRef = useRef<HTMLDivElement>(null);
  const rewardDialogCloseRef = useRef<HTMLButtonElement>(null);
  const rewardDialogReturnFocusRef = useRef<HTMLElement | null>(null);

  const openClaimReveal = useCallback((reveal: ClaimReveal) => {
    if (
      typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
    ) {
      rewardDialogReturnFocusRef.current = document.activeElement;
    }
    setClaimReveal(reveal);
  }, []);

  const closeClaimReveal = useCallback(() => {
    setClaimReveal(null);
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      rewardDialogReturnFocusRef.current?.focus();
      rewardDialogReturnFocusRef.current = null;
    });
  }, []);

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
    if (!claimReveal) return;

    const frame = window.requestAnimationFrame(() => {
      rewardDialogCloseRef.current?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeClaimReveal();
        return;
      }

      if (event.key !== "Tab") return;
      const dialog = rewardDialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("aria-hidden"));

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [claimReveal, closeClaimReveal]);

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
      openClaimReveal({ kind: "reward", reward });
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

  async function claimRewardGroup(
    rewards: ReadonlyArray<BattlePassRewardPresentation>,
  ) {
    const anchor = rewards[0];
    if (!anchor || pendingRewardId || claimAllPending) return;

    setPendingRewardId(anchor.id);
    setFeedback(null);
    try {
      const response = await fetch("/api/battle-pass/rewards/claim-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId: anchor.id }),
      });
      if (!response.ok) throw new Error("claim_group_failed");

      const result = (await response.json()) as {
        claimedCount?: number;
        alreadyClaimedCount?: number;
      };
      setFeedback({
        title: "CONJUNTO OBTIDO",
        detail: `${INTEGER.format(result.claimedCount ?? 0)} itens recebidos`,
      });
      openClaimReveal({
        kind: "group",
        rewards,
        claimedCount: result.claimedCount ?? 0,
        alreadyClaimedCount: result.alreadyClaimedCount ?? 0,
      });
      router.refresh();
    } catch {
      setFeedback({
        title: "CONJUNTO INDISPONÍVEL",
        detail: "Não foi possível confirmar a coleta do conjunto agora.",
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
        alreadyClaimedCount?: number;
        creditAmount?: number;
        gameCosmeticCount?: number;
        titleCount?: number;
        backgroundCount?: number;
        rewards?: ReadonlyArray<{
          rewardId?: string;
          kind?: string;
          alreadyClaimed?: boolean;
        }>;
      };
      const claimedCount = result.claimedCount ?? 0;
      const alreadyClaimedCount = result.alreadyClaimedCount ?? 0;
      const creditAmount = result.creditAmount ?? 0;
      const gameCosmeticCount = result.gameCosmeticCount ?? 0;
      const titleCount = result.titleCount ?? 0;
      const backgroundCount = result.backgroundCount ?? 0;
      const claimedRewardIds = new Set(
        (result.rewards ?? [])
          .filter((reward) => reward.alreadyClaimed !== true)
          .map((reward) => reward.rewardId)
          .filter((rewardId): rewardId is string => Boolean(rewardId)),
      );
      const level100Titles = snapshot.levels
        .find((level) => level.level === 100)
        ? [
            ...(
              snapshot.levels.find((level) => level.level === 100)?.freeRewards ??
              []
            ),
            ...(
              snapshot.levels.find((level) => level.level === 100)
                ?.premiumRewards ?? []
            ),
          ]
            .filter(
              (reward) =>
                reward.kind === "commander_title" &&
                claimedRewardIds.has(reward.id),
            )
            .map((reward) => ({
              name: reward.name,
              track: reward.track,
            }))
        : [];
      setFeedback({
        title: "RECOMPENSAS RECEBIDAS",
        detail: `${INTEGER.format(claimedCount)} recompensas · +${INTEGER.format(creditAmount)} CR`,
      });
      openClaimReveal({
        kind: "batch",
        claimedCount,
        alreadyClaimedCount,
        creditAmount,
        gameCosmeticCount,
        titleCount,
        backgroundCount,
        level100Titles,
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
      setPremiumConfirmationOpen(false);
      setFeedback({
        title: "TRILHA DE ELITE ATIVADA",
        detail:
          snapshot.premium.retroactiveClaimableCount > 0
            ? `${INTEGER.format(snapshot.premium.retroactiveClaimableCount)} recompensas Elite foram liberadas para coleta.`
            : "A Trilha de Elite está ativa para os próximos níveis.",
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
              {snapshot.premium.retroactiveClaimableCount > 0 ? (
                <span className={styles.premiumRetroactive}>
                  {INTEGER.format(snapshot.premium.retroactiveClaimableCount)}{" "}
                  RECOMPENSAS JÁ DESBLOQUEADAS
                </span>
              ) : null}
              {!premiumConfirmationOpen ? (
                <button
                  type="button"
                  disabled={
                    premiumPending ||
                    snapshot.premium.offerId === null ||
                    snapshot.walletBalance < snapshot.premium.price
                  }
                  onClick={() => setPremiumConfirmationOpen(true)}
                >
                  {snapshot.premium.offerId === null
                    ? "ELITE INDISPONÍVEL"
                    : snapshot.walletBalance < snapshot.premium.price
                      ? "CRÉDITOS INSUFICIENTES"
                      : "REVISAR ATIVAÇÃO · 3.000 CR"}
                </button>
              ) : (
                <div
                  className={styles.premiumConfirmation}
                  role="group"
                  aria-label="Confirmar ativação da Trilha de Elite"
                >
                  <dl>
                    <div>
                      <dt>SALDO ATUAL</dt>
                      <dd>{INTEGER.format(snapshot.walletBalance)} CR</dd>
                    </div>
                    <div>
                      <dt>PREÇO</dt>
                      <dd>{INTEGER.format(snapshot.premium.price)} CR</dd>
                    </div>
                    <div>
                      <dt>APÓS A COMPRA</dt>
                      <dd>
                        {INTEGER.format(
                          snapshot.walletBalance - snapshot.premium.price,
                        )}{" "}
                        CR
                      </dd>
                    </div>
                    <div>
                      <dt>LIBERAÇÃO IMEDIATA</dt>
                      <dd>
                        {INTEGER.format(
                          snapshot.premium.retroactiveClaimableCount,
                        )}{" "}
                        recompensas
                      </dd>
                    </div>
                  </dl>
                  <div className={styles.premiumConfirmationActions}>
                    <button
                      type="button"
                      disabled={premiumPending}
                      onClick={() => setPremiumConfirmationOpen(false)}
                    >
                      CANCELAR
                    </button>
                    <button
                      type="button"
                      disabled={premiumPending}
                      onClick={() => void activatePremium()}
                    >
                      {premiumPending
                        ? "ATIVANDO..."
                        : "CONFIRMAR · 3.000 CR"}
                    </button>
                  </div>
                </div>
              )}
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
                  groupedRewards(level.premiumRewards).map((group) =>
                    group.presentationGroupKey && group.rewards.length > 1 ? (
                      <RewardGroupCard
                        key={`group:${group.presentationGroupKey}`}
                        rewards={group.rewards}
                        pending={group.rewards.some(
                          (reward) => pendingRewardId === reward.id,
                        )}
                        onClaim={(items) => void claimRewardGroup(items)}
                      />
                    ) : (
                      group.rewards.map((reward) => (
                        <RewardCard
                          key={reward.id}
                          reward={reward}
                          pending={pendingRewardId === reward.id}
                          onClaim={(item) => void claimReward(item)}
                        />
                      ))
                    ),
                  )
                ) : (
                  <span className={styles.noReward}>SEM RECOMPENSA</span>
                )}
              </div>

              <span className={styles.axisPoint} aria-hidden="true" />

              <div className={styles.levelRewards} data-track="free">
                {level.freeRewards.length > 0 ? (
                  groupedRewards(level.freeRewards).map((group) =>
                    group.presentationGroupKey && group.rewards.length > 1 ? (
                      <RewardGroupCard
                        key={`group:${group.presentationGroupKey}`}
                        rewards={group.rewards}
                        pending={group.rewards.some(
                          (reward) => pendingRewardId === reward.id,
                        )}
                        onClaim={(items) => void claimRewardGroup(items)}
                      />
                    ) : (
                      group.rewards.map((reward) => (
                        <RewardCard
                          key={reward.id}
                          reward={reward}
                          pending={pendingRewardId === reward.id}
                          onClaim={(item) => void claimReward(item)}
                        />
                      ))
                    ),
                  )
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
          ref={rewardDialogRef}
          className={styles.rewardRevealBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Recompensa recebida"
        >
          <section className={styles.rewardRevealCard}>
            <small>
              {claimReveal.kind === "reward" &&
              claimReveal.reward.level === 100 &&
              claimReveal.reward.kind === "commander_title"
                ? "CAMPANHA CONCLUÍDA"
                : claimReveal.kind === "batch" &&
                    claimReveal.level100Titles.length > 0
                  ? "CAMPANHA CONCLUÍDA"
                  : "RECOMPENSA RECEBIDA"}
            </small>
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
            ) : claimReveal.kind === "group" ? (
              <>
                <div className={styles.rewardRevealGroup}>
                  {claimReveal.rewards.map((reward) => (
                    <div key={reward.id}>
                      <RewardVisual reward={reward} />
                    </div>
                  ))}
                </div>
                <strong>Conjunto Inicial de Elite</strong>
                <span>
                  {INTEGER.format(claimReveal.claimedCount)} itens recebidos
                  {claimReveal.alreadyClaimedCount > 0
                    ? ` · ${INTEGER.format(claimReveal.alreadyClaimedCount)} já coletados`
                    : ""}
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
                  +{INTEGER.format(claimReveal.creditAmount)} CR ·{" "}
                  {INTEGER.format(claimReveal.gameCosmeticCount)} cosméticos ·{" "}
                  {INTEGER.format(claimReveal.backgroundCount)} backgrounds ·{" "}
                  {INTEGER.format(claimReveal.titleCount)} títulos
                </span>
                {claimReveal.alreadyClaimedCount > 0 ? (
                  <span>
                    {INTEGER.format(claimReveal.alreadyClaimedCount)} recompensas
                    já estavam coletadas.
                  </span>
                ) : null}
                {claimReveal.level100Titles.map((title) => (
                  <span key={`${title.track}:${title.name}`}>
                    {title.track === "premium"
                      ? "TRILHA DE ELITE"
                      : "TRILHA LIVRE"}{" "}
                    · {title.name}
                  </span>
                ))}
              </>
            )}
            <button
              ref={rewardDialogCloseRef}
              type="button"
              onClick={closeClaimReveal}
            >
              CONTINUAR
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
