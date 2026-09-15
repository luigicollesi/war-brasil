"use client";

import { ProfileV4Boundary } from "@/src/components/profile/v4/profile-v4-boundary";

type ProfileErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ProfileError({ error, reset }: ProfileErrorProps) {
  void error;

  return (
    <ProfileV4Boundary
      variant="error"
      eyebrow="SINCRONIZAÇÃO // INTERROMPIDA"
      title="O Quartel não pôde ser aberto"
      description="Nenhum dado fictício foi usado para preencher a falha. Tente sincronizar novamente ou retorne ao comando."
      action={
        <button type="button" onClick={reset}>
          Tentar novamente
        </button>
      }
    />
  );
}
