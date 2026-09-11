"use client";

import { WarShell } from "@/src/components/war-shell";

type ProfileErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ProfileError({ error, reset }: ProfileErrorProps) {
  void error;

  return (
    <WarShell title="Salão de Comando" backHref="/" backLabel="Início">
      <main className="wb-page">
        <div className="wb-shell-inner">
          <p className="wb-kicker">Arquivo indisponível</p>
          <h1 className="wb-page-title">O registro não pôde ser aberto.</h1>
          <p className="wb-page-lead">
            Nenhum dado fictício será exibido para preencher a ausência do perfil. Tente consultar
            a fonte novamente.
          </p>
          <button className="wb-button wb-button--secondary mt-7" type="button" onClick={reset}>
            Tentar novamente
          </button>
        </div>
      </main>
    </WarShell>
  );
}
