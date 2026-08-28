import Image from "next/image";
import Link from "next/link";
import { GameQuickGuide } from "@/src/components/game-guide/game-quick-guide";
import { WarShell } from "@/src/components/war-shell";

export default function Home() {
  return (
    <WarShell immersive>
      <main className="wb-shell-inner">
        <section className="wb-home">
          <div className="wb-home-grid">
            <div className="wb-home-copy">
              <div className="mb-5 flex items-center gap-4">
                <Image
                  src="/icone.png"
                  alt=""
                  width={128}
                  height={128}
                  loading="eager"
                  sizes="(max-width: 767px) 96px, 128px"
                  className="h-24 w-24 rounded-[22%] object-cover shadow-[0_18px_40px_rgba(0,0,0,.24)] sm:h-28 sm:w-28"
                />
                <p className="wb-kicker">Estratégia em território nacional</p>
              </div>

              <h1 className="wb-home-title">
                War
                <strong>Brasil</strong>
              </h1>
              <p className="wb-page-lead">
                Conquiste territórios, atravesse barreiras e conduza sua facção por
                um Brasil transformado em campo de estratégia.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/matchmaking" className="wb-button wb-button--primary">
                  <span className="wb-diamond" aria-hidden="true" />
                  Jogar
                </Link>
                <a href="#manual" className="wb-button wb-button--ghost">
                  Como jogar
                </a>
              </div>

              <div className="wb-facts" aria-label="Informações da partida">
                <div className="wb-fact">
                  <strong>42</strong>
                  <span>Territórios</span>
                </div>
                <span className="wb-diamond" aria-hidden="true" />
                <div className="wb-fact">
                  <strong>5</strong>
                  <span>Regiões</span>
                </div>
                <span className="wb-diamond" aria-hidden="true" />
                <div className="wb-fact">
                  <strong>2–6</strong>
                  <span>Jogadores</span>
                </div>
              </div>
            </div>

            <div id="mapa" className="wb-home-map" aria-label="Prévia do mapa do jogo">
              <Image
                src="/war-brasil-42.production.svg"
                alt="Mapa do Brasil dividido em 42 territórios"
                width={1254}
                height={1254}
                priority
              />
            </div>
          </div>
        </section>

        <GameQuickGuide />
      </main>
    </WarShell>
  );
}
