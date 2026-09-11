import { WarShell } from "@/src/components/war-shell";

export default function ProfileLoading() {
  return (
    <WarShell title="Salão de Comando" backHref="/" backLabel="Início">
      <main className="wb-page" aria-busy="true" aria-live="polite">
        <div className="wb-shell-inner">
          <p className="wb-kicker">Consultando arquivo</p>
          <h1 className="wb-page-title">Recuperando registro de comando</h1>
          <p className="wb-page-lead">
            A identidade permanece sem valores simulados enquanto a fonte de dados é consultada.
          </p>
        </div>
      </main>
    </WarShell>
  );
}
