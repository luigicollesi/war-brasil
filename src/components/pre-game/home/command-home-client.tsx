"use client";

import { useSession } from "@/client/auth-client";
import {
  CommandAuthModal,
  type CommandAuthMode,
} from "@/components/auth/command-auth-modal";
import { CommandOnboardingModal } from "@/components/auth/command-onboarding-modal";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  useCommandSceneDirective,
  useCommandSceneState,
} from "../foundation";
import {
  getHomeSceneIntent,
  type HomeCeremonyPhase,
  type HomeDestinationId,
} from "./command-home-scene-intent";
import "./command-home-intro.module.css";
import styles from "./command-home.module.css";

type VisitMode = "first" | "reduced";
type HomeTransitionState = "preparing" | "primed" | "running" | "complete";
type HomeState =
  | "boot"
  | "awaiting-entry"
  | "auth-check"
  | "auth-modal"
  | "onboarding"
  | "command-open"
  | "destination-focus"
  | "transitioning";

type Destination = {
  id: HomeDestinationId;
  href: string;
  index: string;
  label: string;
  detail: string;
};

type CommandAccessResponse = {
  authenticated?: boolean;
  ageGateComplete?: boolean;
  identityComplete?: boolean;
  profileComplete?: boolean;
  profile?: {
    handle?: string | null;
    displayName?: string | null;
  };
  suggestedDisplayName?: string | null;
};

type CommandHomeClientProps = {
  children: ReactNode;
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const DESTINATIONS: Destination[] = [
  {
    id: "operations",
    href: "/matchmaking",
    index: "01",
    label: "OPERAÇÕES",
    detail: "Autorizar ou localizar uma operação",
  },
  {
    id: "doctrine",
    href: "/rules",
    index: "02",
    label: "DOUTRINA",
    detail: "Consultar princípios e regras de combate",
  },
  {
    id: "profile",
    href: "/profile",
    index: "03",
    label: "COMANDO",
    detail: "Acessar identidade e registro de comando",
  },
];

function subscribeReducedMotion(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getServerReducedMotionSnapshot() {
  return false;
}

export function CommandHomeClient({ children }: CommandHomeClientProps) {
  const [ceremonyPhase, setCeremonyPhase] = useState<HomeCeremonyPhase>("primed");
  const [ritualActive, setRitualActive] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const [keyboardDestinationFocus, setKeyboardDestinationFocus] =
    useState<HomeDestinationId | null>(null);
  const [pointerDestinationFocus, setPointerDestinationFocus] =
    useState<HomeDestinationId | null>(null);
  const [transitioningTo, setTransitioningTo] =
    useState<HomeDestinationId | null>(null);
  const [authChecking, setAuthChecking] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] =
    useState<CommandAuthMode>("login");
  const [authModalNotice, setAuthModalNotice] = useState("");
  const [authResetToken, setAuthResetToken] = useState<string | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingAgeGateComplete, setOnboardingAgeGateComplete] = useState(true);
  const [onboardingIdentityComplete, setOnboardingIdentityComplete] = useState(false);
  const [onboardingHandle, setOnboardingHandle] = useState<string | null>(null);
  const [onboardingDisplayName, setOnboardingDisplayName] = useState<
    string | null
  >(null);
  const {
    data: authSession,
    isPending: authSessionPending,
    refetch: refetchAuthSession,
  } = useSession();

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot,
  );
  const sceneState = useCommandSceneState();

  const visitMode: VisitMode = reducedMotion ? "reduced" : "first";
  const effectiveCeremonyPhase: HomeCeremonyPhase =
    visitMode === "first" && ritualActive && sceneState !== "fallback"
      ? ceremonyPhase
      : "stable";
  const homeTransition: HomeTransitionState =
    visitMode !== "first" || !ritualActive || sceneState === "fallback"
      ? "complete"
      : ceremonyPhase === "playing"
        ? "running"
        : sceneState === "loading"
          ? "preparing"
          : sceneState === "primed"
            ? "primed"
            : sceneState === "playing" || sceneState === "settling"
              ? "running"
              : "complete";
  const destinationFocus = keyboardDestinationFocus ?? pointerDestinationFocus;
  const sceneIntent = getHomeSceneIntent({
    ceremonyPhase: effectiveCeremonyPhase,
    commandOpen,
    destinationFocus,
    transitioningTo,
  });

  useCommandSceneDirective(sceneIntent);

  const openAuthModal = useCallback(
    (mode: CommandAuthMode = "login", notice = "") => {
      setOnboardingOpen(false);
      setAuthModalMode(mode);
      setAuthModalNotice(notice);
      setAuthResetToken(null);
      setAuthModalOpen(true);
    },
    [],
  );

  const applyCommandAccess = useCallback((payload: CommandAccessResponse) => {
    if (payload.authenticated && payload.profileComplete) {
      setOnboardingOpen(false);
      setCommandOpen(true);
      return "command-open" as const;
    }

    if (payload.authenticated) {
      setCommandOpen(false);
      setOnboardingAgeGateComplete(payload.ageGateComplete !== false);
      setOnboardingIdentityComplete(payload.identityComplete === true);
      setOnboardingHandle(payload.profile?.handle ?? null);
      setOnboardingDisplayName(
        payload.profile?.displayName ?? payload.suggestedDisplayName ?? null,
      );
      setOnboardingOpen(true);
      return "onboarding" as const;
    }

    return "unauthenticated" as const;
  }, []);

  const checkCommandAccess = useCallback(
    async (openLoginOnUnauthorized = true) => {
      setAuthChecking(true);
      try {
        const response = await fetch("/api/auth/command-access", {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (response.status === 401) {
          setCommandOpen(false);
          setOnboardingOpen(false);
          if (openLoginOnUnauthorized) {
            openAuthModal("login");
          }
          return "unauthenticated" as const;
        }

        if (!response.ok) {
          throw new Error("command_access_unavailable");
        }

        const payload = (await response.json()) as CommandAccessResponse;
        return applyCommandAccess(payload);
      } catch {
        setCommandOpen(false);
        setOnboardingOpen(false);
        openAuthModal(
          "login",
          "Não foi possível validar uma sessão salva. Entre novamente para continuar.",
        );
        return "error" as const;
      } finally {
        setAuthChecking(false);
      }
    },
    [applyCommandAccess, openAuthModal],
  );

  useEffect(() => {
    if (
      visitMode !== "first" ||
      !ritualActive ||
      ceremonyPhase !== "primed" ||
      sceneState !== "primed"
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setCeremonyPhase("playing");
    });

    return () => window.cancelAnimationFrame(frame);
  }, [ceremonyPhase, ritualActive, sceneState, visitMode]);

  useEffect(() => {
    if (
      visitMode !== "first" ||
      !ritualActive ||
      ceremonyPhase === "stable" ||
      sceneState !== "ready"
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setCeremonyPhase("stable");
      setRitualActive(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [ceremonyPhase, ritualActive, sceneState, visitMode]);

  useEffect(() => {
    if (authSessionPending) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      const shouldContinueCommand = params.get("continue") === "command";
      const emailVerified = params.get("emailVerified");
      const resetPassword = params.get("auth") === "reset-password";
      const resetToken = params.get("token");

      if (resetPassword) {
        setAuthResetToken(resetToken);
        setAuthModalMode("reset");
        setAuthModalNotice(
          resetToken
            ? "Defina uma nova senha para concluir a recuperação."
            : "Este link de redefinição não contém um token válido.",
        );
        setAuthModalOpen(true);
        return;
      }

      if (shouldContinueCommand && authSession) {
        setCeremonyPhase("stable");
        setRitualActive(false);
        setAuthModalOpen(false);
        void checkCommandAccess(false).then((result) => {
          if (result === "unauthenticated") {
            openAuthModal(
              "login",
              "A sessão retornada não pôde ser validada. Entre novamente.",
            );
          }
          window.history.replaceState({}, "", "/");
        });
        return;
      }

      if (emailVerified === "success") {
        setAuthModalMode("login");
        setAuthModalNotice(
          "Email confirmado. Entre com sua credencial para acessar o Comando.",
        );
        setAuthModalOpen(true);
        window.history.replaceState({}, "", "/?continue=command");
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    authSession,
    authSessionPending,
    checkCommandAccess,
    openAuthModal,
  ]);

  const settleCeremony = () => {
    setCeremonyPhase("stable");
    setRitualActive(false);
  };

  const skipCeremony = () => {
    settleCeremony();
  };

  const enterCommand = () => {
    settleCeremony();
    setKeyboardDestinationFocus(null);
    setPointerDestinationFocus(null);
    void checkCommandAccess();
  };

  const handleAuthenticated = async () => {
    await refetchAuthSession();
    setAuthModalOpen(false);
    setAuthModalNotice("");
    setAuthResetToken(null);

    const result = await checkCommandAccess(false);
    if (result === "unauthenticated") {
      openAuthModal(
        "login",
        "A autenticação não gerou uma sessão válida. Tente entrar novamente.",
      );
      return;
    }

    window.history.replaceState({}, "", "/");
  };

  const handleOnboardingCompleted = async () => {
    setOnboardingOpen(false);
    const result = await checkCommandAccess(false);

    if (result !== "command-open") {
      if (result === "unauthenticated") {
        openAuthModal("login", "Sua sessão expirou. Entre novamente para continuar.");
      }
      return;
    }

    window.history.replaceState({}, "", "/");
  };

  const handleUnderageAccountDeleted = async () => {
    setOnboardingOpen(false);
    setCommandOpen(false);
    await refetchAuthSession();
    window.history.replaceState({}, "", "/");
  };

  const clearKeyboardFocus = (destination: HomeDestinationId) => {
    setKeyboardDestinationFocus((current) =>
      current === destination ? null : current,
    );
  };

  const clearPointerFocus = (destination: HomeDestinationId) => {
    setPointerDestinationFocus((current) =>
      current === destination ? null : current,
    );
  };

  const homeState: HomeState = transitioningTo
    ? "transitioning"
    : onboardingOpen
      ? "onboarding"
      : authModalOpen
        ? "auth-modal"
        : authChecking
          ? "auth-check"
          : commandOpen && destinationFocus
            ? "destination-focus"
            : commandOpen
              ? "command-open"
              : homeTransition === "preparing" || homeTransition === "primed"
                ? "boot"
                : "awaiting-entry";

  return (
    <main
      className={styles.root}
      data-home-state={homeState}
      data-home-transition={homeTransition}
      data-home-opening-phase={sceneState}
      data-scene="foundation"
      data-scene-state={sceneState}
      data-ceremony={effectiveCeremonyPhase}
      data-visit={visitMode}
      data-command-open={commandOpen ? "true" : "false"}
      data-authenticated={authSession ? "true" : "false"}
      data-profile-onboarding={onboardingOpen ? "true" : "false"}
      data-auth-checking={authChecking ? "true" : "false"}
      data-destination-focus={destinationFocus ?? "none"}
      data-transitioning-to={transitioningTo ?? "none"}
    >
      {children}

      <section
        id="home-command"
        className={styles.commandDock}
        data-home-command-dock
        aria-label="Acesso ao comando"
        tabIndex={-1}
      >
        {!commandOpen ? (
          <div className={styles.authorization}>
            <button
              type="button"
              className={styles.enterButton}
              onClick={enterCommand}
              disabled={authChecking}
            >
              <span className={styles.enterButtonCode} aria-hidden="true">
                A-01
              </span>
              <span>
                {authChecking ? "VALIDANDO CREDENCIAL..." : "ENTRAR NO COMANDO"}
              </span>
              <span className={styles.enterButtonArrow} aria-hidden="true">
                →
              </span>
            </button>

            <div className={styles.authorizationMeta}>
              <span>
                {authChecking
                  ? "CONSULTANDO SESSÃO SEGURA"
                  : "ACESSO OPERACIONAL DISPONÍVEL"}
              </span>
              {effectiveCeremonyPhase !== "stable" && visitMode === "first" ? (
                <button
                  type="button"
                  className={styles.skipCeremony}
                  onClick={skipCeremony}
                >
                  Pular ritual
                </button>
              ) : (
                <span className={styles.ritualState}>
                  {visitMode === "reduced"
                    ? "MOVIMENTO REDUZIDO"
                    : sceneState === "fallback"
                      ? "MODO TÁTICO 2D"
                      : "MESA ESTABILIZADA"}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.openCommand}>
            <div className={styles.commandStatus} role="status">
              <span className={styles.commandStatusMark} aria-hidden="true" />
              COMANDO AUTORIZADO
            </div>

            <nav className={styles.destinationRail} aria-label="Destinos do comando">
              {DESTINATIONS.map((destination) => (
                <Link
                  key={destination.id}
                  href={destination.href}
                  className={styles.destination}
                  data-destination={destination.id}
                  onClick={() => setTransitioningTo(destination.id)}
                  onFocus={() => setKeyboardDestinationFocus(destination.id)}
                  onBlur={() => clearKeyboardFocus(destination.id)}
                  onPointerEnter={() => setPointerDestinationFocus(destination.id)}
                  onPointerLeave={() => clearPointerFocus(destination.id)}
                >
                  <span className={styles.destinationIndex} aria-hidden="true">
                    {destination.index}
                  </span>
                  <span className={styles.destinationCopy}>
                    <strong>{destination.label}</strong>
                    <span>{destination.detail}</span>
                  </span>
                  <span className={styles.destinationArrow} aria-hidden="true">
                    ↗
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        )}
      </section>

      <footer className={styles.footer} data-home-footer>
        <span>DOMÍNIO TERRITORIAL // BRASIL</span>
        <nav className={styles.legalLinks} aria-label="Documentos legais">
          <Link href="/terms">TERMOS DE USO</Link>
          <Link href="/privacy">PRIVACIDADE</Link>
        </nav>
        <span>PROTOCOLO 42-T</span>
      </footer>

      <CommandAuthModal
        open={authModalOpen}
        initialMode={authModalMode}
        notice={authModalNotice}
        resetToken={authResetToken}
        onClose={() => {
          setAuthModalOpen(false);
          setAuthModalNotice("");
          setAuthResetToken(null);
          if (window.location.search) {
            window.history.replaceState({}, "", "/");
          }
        }}
        onAuthenticated={handleAuthenticated}
      />

      {onboardingOpen ? (
        <CommandOnboardingModal
          initialDisplayName={onboardingDisplayName}
          initialHandle={onboardingHandle}
          ageGateComplete={onboardingAgeGateComplete}
          identityComplete={onboardingIdentityComplete}
          onClose={() => setOnboardingOpen(false)}
          onCompleted={handleOnboardingCompleted}
          onAccountDeleted={handleUnderageAccountDeleted}
        />
      ) : null}
    </main>
  );
}
