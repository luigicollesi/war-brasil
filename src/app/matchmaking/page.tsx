import type { Metadata } from "next";
import { CreateRoomButton } from "@/src/components/create-room-button";
import { JoinRoomForm } from "@/src/components/join-room-form";
import { SiteHeader } from "@/src/components/site-header";

export const metadata: Metadata = {
  title: "Encontrar partida",
};

export default function MatchmakingPage() {
  return (
    <div className="min-h-screen bg-[#f3f0e8] text-[#14241f]">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-6 py-14 lg:px-10 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#a67c18]">
            Preparar partida
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Escolha como entrar no mapa.
          </h1>
          <p className="mt-4 max-w-xl leading-7 text-[#64756f]">
            Crie uma sala para convidar seus amigos ou use um código existente.
            Nesta versão inicial, os dados da partida são demonstrativos.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <section className="group relative overflow-hidden rounded-3xl bg-[#12392f] p-7 text-white shadow-[0_18px_50px_rgba(19,57,47,0.16)] sm:p-9">
            <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full border-[36px] border-white/5" />
            <div className="relative">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e4b94f] text-xl text-[#12392f]">
                +
              </span>
              <p className="mt-10 text-xs font-bold uppercase tracking-[0.2em] text-[#9eb8ae]">
                Nova sala
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
                Criar uma partida
              </h2>
              <p className="mt-3 max-w-md leading-7 text-[#b9ccc4]">
                Abra uma sala de demonstração e veja o tabuleiro interativo.
              </p>
              <CreateRoomButton />
            </div>
          </section>

          <section className="rounded-3xl border border-[#17372d]/10 bg-[#faf8f2] p-7 shadow-[0_18px_50px_rgba(42,55,50,0.07)] sm:p-9">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e5dfd0] text-lg text-[#173f34]">
              #
            </span>
            <p className="mt-10 text-xs font-bold uppercase tracking-[0.2em] text-[#8b7a4a]">
              Sala existente
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
              Entrar com código
            </h2>
            <p className="mt-3 leading-7 text-[#64756f]">
              Digite o identificador compartilhado pelo criador da sala.
            </p>
            <JoinRoomForm />
          </section>
        </div>

        <p className="mt-8 flex items-center gap-2 text-sm text-[#7b8984]">
          <span className="h-2 w-2 rounded-full bg-[#d5a937]" />
          Matchmaking, autenticação e tempo real serão conectados em etapas futuras.
        </p>
      </main>
    </div>
  );
}
