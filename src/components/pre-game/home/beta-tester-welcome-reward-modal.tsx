"use client";

import Image from "next/image";
import { useState } from "react";
import { ProfileCosmeticImage } from "@/src/components/profile/v4/profile-cosmetic-image";
import {
  BETA_TESTER_WELCOME_REWARD,
  type BetaTesterWelcomeRewardClaimResult,
} from "@/src/lib/profile/beta-tester-welcome-reward";
import styles from "./beta-tester-welcome-reward-modal.module.css";

type ClaimResponse =
  | BetaTesterWelcomeRewardClaimResult
  | Readonly<{ ok?: false; message?: string }>;

function dicePreviewUrl(assetKey: string) {
  return `/api/assets/dice?key=${encodeURIComponent(assetKey)}`;
}

export function BetaTesterWelcomeRewardModal({
  onClaimed,
}: {
  onClaimed: (result: BetaTesterWelcomeRewardClaimResult) => void;
}) {
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claimReward() {
    if (claiming) return;

    setClaiming(true);
    setError(null);

    try {
      const response = await fetch("/api/profile/beta-tester-reward/claim", {
        method: "POST",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const body = (await response.json().catch(() => null)) as
        | ClaimResponse
        | null;

      if (!response.ok || !body || body.ok !== true) {
        throw new Error(
          body && "message" in body && typeof body.message === "string"
            ? body.message
            : "Não foi possível entregar sua recompensa agora.",
        );
      }

      onClaimed(body);
    } catch (claimError) {
      setError(
        claimError instanceof Error
          ? claimError.message
          : "Não foi possível entregar sua recompensa agora.",
      );
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className={styles.backdrop} data-beta-tester-reward>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="beta-tester-reward-title"
        aria-describedby="beta-tester-reward-description"
      >
        <div className={styles.scanline} aria-hidden="true" />
        <header className={styles.header}>
          <span className={styles.eyebrow}>RECOMPENSA DE PARTICIPAÇÃO // BETA</span>
          <h2 id="beta-tester-reward-title">O Comando reconheceu sua participação</h2>
          <p id="beta-tester-reward-description">
            Seu registro de Beta Tester liberou um pacote especial para começar
            suas próximas operações.
          </p>
        </header>

        <div className={styles.rewards}>
          <article className={styles.rewardCard}>
            <span className={styles.rewardCode}>TÍTULO ÉPICO</span>
            <strong className={styles.titleReward}>
              {BETA_TESTER_WELCOME_REWARD.titleDisplay}
            </strong>
            <small>Disponível no seu Dossiê</small>
          </article>

          <article className={styles.rewardCard}>
            <span className={styles.rewardCode}>ARSENAL BRASIL</span>
            <div className={styles.diceRow} aria-label="Três dados Brasil">
              {BETA_TESTER_WELCOME_REWARD.dice.map((die) => (
                <span className={styles.die} key={die.id}>
                  <ProfileCosmeticImage
                    src={dicePreviewUrl(die.assetKey)}
                    alt={`Dado Brasil de ${die.label.toLowerCase()}`}
                    width={88}
                    height={88}
                    className={styles.dieImage}
                    fallbackClassName={styles.dieFallback}
                    fallbackLabel={die.label.slice(0, 1)}
                  />
                  <small>{die.label}</small>
                </span>
              ))}
            </div>
          </article>

          <article className={styles.rewardCard}>
            <span className={styles.rewardCode}>CRÉDITOS DE CAMPANHA</span>
            <div className={styles.creditReward}>
              <Image src="/coin.svg" alt="" width={46} height={46} aria-hidden="true" />
              <strong>
                +{BETA_TESTER_WELCOME_REWARD.credits.toLocaleString("pt-BR")}
              </strong>
            </div>
            <small>Adicionados ao seu saldo</small>
          </article>
        </div>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className={styles.claimButton}
          disabled={claiming}
          onClick={() => void claimReward()}
        >
          {claiming ? "LIBERANDO RECOMPENSA..." : "RECEBER RECOMPENSA"}
        </button>

        <p className={styles.footnote}>
          A concessão é única por conta e não altera seus cosméticos equipados.
        </p>
      </section>
    </div>
  );
}
