"use client";

import { useCallback, useEffect, useRef } from "react";
import type {
  BattlePassRewardPresentation,
  BattlePassSnapshot,
} from "@/src/lib/shared/progression/battle-pass-presentation";
import {
  BattlePassReward,
  BattlePassRewardGroup,
  groupBattlePassRewards,
} from "./battle-pass-reward";
import styles from "./battle-pass-timeline.module.css";

type BattlePassTimelineProps = Readonly<{
  levels: BattlePassSnapshot["levels"];
  currentLevel: number;
  pendingRewardId: string | null;
  onClaimReward: (reward: BattlePassRewardPresentation) => void;
  onClaimRewardGroup: (
    rewards: ReadonlyArray<BattlePassRewardPresentation>,
  ) => void;
}>;

function RewardStack({
  rewards,
  pendingRewardId,
  onClaimReward,
  onClaimRewardGroup,
}: {
  rewards: ReadonlyArray<BattlePassRewardPresentation>;
  pendingRewardId: string | null;
  onClaimReward: (reward: BattlePassRewardPresentation) => void;
  onClaimRewardGroup: (
    rewards: ReadonlyArray<BattlePassRewardPresentation>,
  ) => void;
}) {
  if (rewards.length === 0) return null;

  return (
    <>
      {groupBattlePassRewards(rewards).map((group) =>
        group.presentationGroupKey && group.rewards.length > 1 ? (
          <BattlePassRewardGroup
            key={`group:${group.presentationGroupKey}`}
            rewards={group.rewards}
            pending={group.rewards.some(
              (reward) => pendingRewardId === reward.id,
            )}
            onClaim={onClaimRewardGroup}
          />
        ) : (
          group.rewards.map((reward) => (
            <BattlePassReward
              key={reward.id}
              reward={reward}
              pending={pendingRewardId === reward.id}
              onClaim={onClaimReward}
            />
          ))
        ),
      )}
    </>
  );
}

export function BattlePassTimeline({
  levels,
  currentLevel,
  pendingRewardId,
  onClaimReward,
  onClaimRewardGroup,
}: BattlePassTimelineProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const levelRefs = useRef(new Map<number, HTMLElement>());

  const centerCurrentLevel = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const viewport = viewportRef.current;
      const level = levelRefs.current.get(currentLevel);
      if (!viewport || !level) return;

      const compact = window.matchMedia("(max-width: 760px)").matches;
      if (compact) {
        const top =
          level.offsetTop - viewport.clientHeight / 2 + level.offsetHeight / 2;
        viewport.scrollTo({ top: Math.max(0, top), behavior });
        return;
      }

      const left =
        level.offsetLeft - viewport.clientWidth / 2 + level.offsetWidth / 2;
      viewport.scrollTo({ left: Math.max(0, left), behavior });
    },
    [currentLevel],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      centerCurrentLevel("auto");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [centerCurrentLevel]);

  const revealCurrentLevel = () => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const level = levelRefs.current.get(currentLevel);
    if (!level) return;

    level.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  };

  return (
    <div className={styles.timeline}>
      <div className={styles.timelineToolbar}>
        <div className={styles.trackLabels} aria-hidden="true">
          <span>TRILHA DE ELITE</span>
          <span>TRILHA LIVRE</span>
        </div>
        <button type="button" onClick={revealCurrentLevel}>
          NÍVEL ATUAL
        </button>
      </div>

      <div
        ref={viewportRef}
        className={styles.viewport}
        role="region"
        aria-label="Recompensas do Passe de Campanha por nível"
        tabIndex={0}
      >
        <div className={styles.mobileTrackLabels} aria-hidden="true">
          <span>ELITE</span>
          <span>LIVRE</span>
        </div>
        <div className={styles.rail}>
          {levels.map((level) => {
            const current = level.level === currentLevel;
            return (
              <article
                key={level.level}
                ref={(element) => {
                  if (element) levelRefs.current.set(level.level, element);
                  else levelRefs.current.delete(level.level);
                }}
                className={styles.levelNode}
                data-current={current ? "true" : undefined}
                aria-label={current ? `Nível ${level.level}, nível atual` : `Nível ${level.level}`}
              >
                <div className={styles.premiumZone} data-track="premium">
                  <RewardStack
                    rewards={level.premiumRewards}
                    pendingRewardId={pendingRewardId}
                    onClaimReward={onClaimReward}
                    onClaimRewardGroup={onClaimRewardGroup}
                  />
                </div>

                <div className={styles.axisCell} aria-hidden="true">
                  <span className={styles.axisMarker}>
                    <strong>{level.level}</strong>
                    {current ? <small>ATUAL</small> : null}
                  </span>
                </div>

                <div className={styles.freeZone} data-track="free">
                  <RewardStack
                    rewards={level.freeRewards}
                    pendingRewardId={pendingRewardId}
                    onClaimReward={onClaimReward}
                    onClaimRewardGroup={onClaimRewardGroup}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <p className={styles.timelineHint}>
        100 NÍVEIS · ARRASTE PARA EXPLORAR A CAMPANHA
      </p>
    </div>
  );
}
