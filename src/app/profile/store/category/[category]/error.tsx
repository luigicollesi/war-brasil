"use client";

import { StoreCategoryBoundary } from "@/src/components/profile/v4/store-category-boundary";

export default function StoreCategoryError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  void error;

  return (
    <StoreCategoryBoundary
      variant="error"
      eyebrow="CATÁLOGO // SINCRONIZAÇÃO INTERROMPIDA"
      title="O catálogo não pôde ser aberto"
      description="Os dados de exposição não puderam ser sincronizados. Tente novamente ou retorne à Intendência."
      action={<button type="button" onClick={reset}>Tentar novamente</button>}
    />
  );
}
