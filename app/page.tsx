import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/src/components/site-header";

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#071c18] text-[#f7f2e7]">
      <SiteHeader theme="dark" />

      <main>
        <section className="relative mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl items-center gap-14 px-6 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-10 lg:py-20">
          <div className="pointer-events-none absolute -left-48 top-24 h-96 w-96 rounded-full bg-[#d5a937]/10 blur-3xl" />

          <div className="relative z-10 max-w-xl">
            <p className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.26em] text-[#dfbd67]">
              <span className="h-px w-8 bg-[#dfbd67]" />
              Estratégia em território nacional
            </p>
            <h1 className="text-5xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              O Brasil inteiro
              <span className="block font-serif italic text-[#dfbd67]">
                em disputa.
              </span>
            </h1>
            <p className="mt-7 max-w-lg text-base leading-7 text-[#b9c8c1] sm:text-lg">
              Reúna seus aliados, ocupe territórios e prepare sua estratégia em
              um tabuleiro inspirado nas cinco regiões do país.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/matchmaking"
                className="inline-flex h-13 items-center justify-center gap-3 rounded-full bg-[#e4b94f] px-8 text-sm font-bold uppercase tracking-[0.12em] text-[#10231e] transition hover:-translate-y-0.5 hover:bg-[#f1ca68] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e4b94f]"
              >
                Jogar
                <span aria-hidden="true">→</span>
              </Link>
              <a
                href="#mapa"
                className="inline-flex h-13 items-center justify-center rounded-full border border-white/15 px-8 text-sm font-semibold text-[#f7f2e7] transition hover:border-white/35 hover:bg-white/5"
              >
                Conhecer o mapa
              </a>
            </div>

            <dl className="mt-12 grid max-w-md grid-cols-3 gap-5 border-t border-white/10 pt-7">
              <div>
                <dt className="text-xs uppercase tracking-widest text-[#82958d]">
                  Territórios
                </dt>
                <dd className="mt-1 text-2xl font-semibold">42</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-widest text-[#82958d]">
                  Regiões
                </dt>
                <dd className="mt-1 text-2xl font-semibold">5</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-widest text-[#82958d]">
                  Vencedor
                </dt>
                <dd className="mt-1 text-2xl font-semibold">1</dd>
              </div>
            </dl>
          </div>

          <div id="mapa" className="relative mx-auto w-full max-w-2xl">
            <div className="absolute inset-10 rounded-full bg-[#4d8b5a]/20 blur-3xl" />
            <div className="relative rounded-[2rem] border border-white/10 bg-[#0c2923]/80 p-4 shadow-2xl shadow-black/30 sm:p-7">
              <div className="mb-4 flex items-center justify-between px-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#82958d]">
                    Tabuleiro oficial
                  </p>
                  <p className="mt-1 text-sm font-semibold">Brasil · 42 territórios</p>
                </div>
                <span className="rounded-full border border-[#dfbd67]/30 bg-[#dfbd67]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#dfbd67]">
                  Prévia
                </span>
              </div>
              <div className="rounded-[1.4rem] bg-[#f2eddf] p-3 sm:p-5">
                <Image
                  src="/war-brasil-42.production.svg"
                  alt="Mapa do Brasil dividido em 42 territórios"
                  width={1254}
                  height={1254}
                  priority
                  className="h-auto w-full drop-shadow-[0_16px_22px_rgba(15,35,29,0.2)]"
                />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
