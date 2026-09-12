"use client";

import { ProfileBoundaryState } from "@/src/components/profile/profile-boundary-state";
import { ProfileSceneBridge } from "@/src/components/profile/profile-command-shell";

type ProfileErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ProfileError({ error, reset }: ProfileErrorProps) {
  void error;

  return (
    <ProfileSceneBridge>
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
    </ProfileSceneBridge>
  );
}
