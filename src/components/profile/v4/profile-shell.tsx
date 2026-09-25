"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { authClient } from "@/client/auth-client";
import { useCommandSceneDirective } from "@/src/components/pre-game/foundation";
import styles from "./profile-shell.module.css";

export type ProfileSurface = "dossier" | "arsenal" | "store";

export type ProfileShellWallet =
  | Readonly<{
      available: true;
      balance: number;
      label: string;
    }>
  | Readonly<{
      available: false;
      reason?: string;
    }>;

const PROFILE_LOGOUT_TRANSITION_MS = 280;

const NAV_ITEMS: ReadonlyArray<{
  id: ProfileSurface;
  href: string;
  label: string;
  eyebrow: string;
}> = [
  { id: "dossier", href: "/profile", label: "Dossiê", eyebrow: "Identidade" },
  { id: "arsenal", href: "/profile/arsenal", label: "Arsenal", eyebrow: "Equipamento" },
  { id: "store", href: "/profile/store", label: "Intendência", eyebrow: "Aquisição" },
];

const SCENE_DIRECTIVES = {
  dossier: {
    focus: "insignia",
    conflictLevel: 0,
    territoryExplode: 0,
    orbitalAlignment: 1,
  },
  arsenal: {
    focus: "table",
    conflictLevel: 0,
    territoryExplode: 0.035,
    orbitalAlignment: 1,
  },
  store: {
    focus: "table",
    conflictLevel: 0,
    territoryExplode: 0.07,
    orbitalAlignment: 0,
  },
} as const;

function formatBalance(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function ProfileShell({
  activeSurface,
  displayName,
  handle,
  wallet,
  backgroundAssetRef = null,
  evaluationFixture = false,
  children,
}: {
  activeSurface: ProfileSurface;
  displayName: string;
  handle: string | null;
  wallet: ProfileShellWallet;
  backgroundAssetRef?: string | null;
  evaluationFixture?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [logoutState, setLogoutState] = useState<"idle" | "closing" | "error">("idle");
  useCommandSceneDirective(SCENE_DIRECTIVES[activeSurface]);

  async function handleLogout() {
    if (logoutState === "closing") return;

    setLogoutState("closing");
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const transitionDelay = reducedMotion ? 0 : PROFILE_LOGOUT_TRANSITION_MS;
    const transition = new Promise<void>((resolve) => {
      window.setTimeout(resolve, transitionDelay);
    });

    try {
      const { error } = await authClient.signOut();
      if (error) {
        setLogoutState("error");
        return;
      }

      await transition;
      router.replace("/");
    } catch {
      setLogoutState("error");
    }
  }

  return (
    <main
      className={styles.page}
      data-scene="profile"
      data-profile-v4
      data-active-surface={activeSurface}
      data-evaluation-fixture={evaluationFixture || undefined}
      data-session-state={logoutState}
    >
      {backgroundAssetRef ? (
        <>
          <div
            className={styles.profileBackdrop}
            style={{ backgroundImage: `url("${backgroundAssetRef}")` }}
            aria-hidden="true"
          />
          <div className={styles.profileBackdropScrim} aria-hidden="true" />
        </>
      ) : null}

      <div className={styles.ambient} aria-hidden="true">
        <span className={styles.scanline} />
        <span className={styles.radial} />
      </div>

      <header className={styles.commandBar}>
        <div className={styles.commandIdentity}>
          <Link
            href="/home"
            className={styles.homeLink}
            aria-label="Retornar ao comando principal"
          >
            <svg
              className={styles.homeIcon}
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M14.5 5.5 8 12l6.5 6.5M8.5 12H19" />
            </svg>
          </Link>
          <span className={styles.commandCopy}>
            <small>QUARTEL DO COMANDANTE</small>
            <strong>{displayName}</strong>
            {handle ? <em>@{handle}</em> : null}
          </span>
        </div>

        <nav className={styles.primaryNav} aria-label="Áreas do Quartel do Comandante">
          {NAV_ITEMS.map((item) => {
            const active = item.id === activeSurface;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={styles.navItem}
                data-active={active ? "true" : "false"}
                aria-current={active ? "page" : undefined}
              >
                <small>{item.eyebrow}</small>
                <strong>{item.label}</strong>
              </Link>
            );
          })}
        </nav>

        <div className={styles.walletCluster} data-wallet-available={wallet.available ? "true" : "false"}>
          <div className={styles.walletReadout}>
            <Image
              src="/coin.svg"
              alt=""
              aria-hidden="true"
              width={34}
              height={34}
              className={styles.coin}
              priority
            />
            <span className={styles.walletCopy}>
              <small>{wallet.available ? wallet.label : "CRÉDITOS DE CAMPANHA"}</small>
              {wallet.available ? (
                <strong
                  className={styles.walletBalance}
                  title={`${formatBalance(wallet.balance)} ${wallet.label}`}
                >
                  {formatBalance(wallet.balance)}
                </strong>
              ) : (
                <strong className={styles.walletUnavailable}>INDISPONÍVEL</strong>
              )}
            </span>
          </div>
          <Link
            href="/profile/store#store-credits"
            className={styles.addCredits}
            aria-label="Ver opções para reforçar Tesouraria"
            title={wallet.available ? "Reforçar Tesouraria" : wallet.reason}
          >
            +
          </Link>
          {!evaluationFixture ? (
            <button
              type="button"
              className={styles.logoutButton}
              aria-label="Encerrar sessão"
              disabled={logoutState === "closing"}
              data-state={logoutState}
              onClick={() => void handleLogout()}
            >
              <span className={styles.logoutIcon} aria-hidden="true">↪</span>
              <span className={styles.logoutLabel}>
                {logoutState === "closing"
                  ? "SAINDO..."
                  : logoutState === "error"
                    ? "TENTAR NOVAMENTE"
                    : "SAIR"}
              </span>
            </button>
          ) : null}
        </div>
      </header>

      {evaluationFixture ? <span className={styles.evalBadge}>FIXTURE DE AVALIAÇÃO</span> : null}

      <div className={styles.surface}>{children}</div>
    </main>
  );
}
