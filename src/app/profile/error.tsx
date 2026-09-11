"use client";

import { CommandShell } from "@/src/components/pre-game/foundation";
import { ProfileBoundaryState } from "@/src/components/profile/profile-boundary-state";
import { WarShell } from "@/src/components/war-shell";

type ProfileErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ProfileError({ error, reset }: ProfileErrorProps) {
  void error;

  return (
    <CommandShell
      intent={{ mode: "profile", focus: "insignia", conflictLevel: 0 }}
      chrome={false}
      sectionLabel="Salão de Comando"
    >
      <WarShell title="Salão de Comando" backHref="/" backLabel="Início">
        <ProfileBoundaryState
          variant="error"
          eyebrow="Arquivo indisponível"
          title="O registro não pôde ser aberto"
          description="Nenhum dado fictício será exibido para preencher a ausência do perfil. A falha permanece isolada ao arquivo do comandante."
          action={
            <button className="wb-button wb-button--secondary" type="button" onClick={reset}>
              Tentar novamente
            </button>
          }
        />
      </WarShell>
    </CommandShell>
  );
}
