import type { Metadata } from "next";
import { CreateRoomButton } from "@/src/components/create-room-button";
import { JoinRoomForm } from "@/src/components/join-room-form";
import { WarShell } from "@/src/components/war-shell";

export const metadata: Metadata = {
  title: "Central de Operações",
};

export default function MatchmakingPage() {
  return (
    <WarShell
      backHref="/"
      backLabel="Início"
      title="Central de Operações"
    >
      <main className="wb-shell-inner wb-page">
        <div>
          <p className="wb-kicker">Preparar partida</p>
          <h1 className="wb-page-title">Como você quer entrar na disputa?</h1>
          <p className="wb-page-lead">
            Crie uma nova sala para reunir seus aliados ou entre diretamente com
            o código compartilhado pelo anfitrião.
          </p>
        </div>

        <div className="wb-matchmaking-grid">
          <section className="wb-matchmaking-action" aria-labelledby="create-room-title">
            <div>
              <p className="wb-kicker">Nova partida</p>
              <h2 id="create-room-title">Criar uma sala</h2>
              <p>
                Abra uma nova operação e prepare uma partida para até seis
                jogadores.
              </p>
              <div className="mt-5 flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--wb-text-muted)]">
                <span>2–6 jogadores</span>
                <span className="wb-diamond" aria-hidden="true" />
                <span>Mapa completo</span>
              </div>
            </div>
            <CreateRoomButton />
          </section>

          <div className="wb-matchmaking-separator" aria-hidden="true" />

          <section className="wb-matchmaking-action" aria-labelledby="join-room-title">
            <div>
              <p className="wb-kicker">Sala existente</p>
              <h2 id="join-room-title">Entrar com código</h2>
              <p>
                Use o identificador da sala para entrar imediatamente na mesma
                preparação de partida dos outros jogadores.
              </p>
            </div>
            <JoinRoomForm />
          </section>
        </div>
      </main>
    </WarShell>
  );
}
