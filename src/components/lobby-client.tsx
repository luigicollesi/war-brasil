"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PLAYER_COLORS, type LobbyPlayer } from "@/src/lib/lobby";
import { useLobbySync } from "@/src/hooks/use-lobby-sync";

type LobbyClientProps = {
  code: string;
};

type RoomUpdateResponse = {
  room?: {
    id?: string;
    status?: "waiting" | "order_roll" | "playing";
  };
  error?: string;
};

function colorByValue(value: string) {
  return PLAYER_COLORS.find((color) => color.value === value);
}

export function LobbyClient({ code }: LobbyClientProps) {
  const router = useRouter();
  const { snapshot, error: syncError, isLoading, refresh } = useLobbySync(code);
  const [actionError, setActionError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (snapshot && snapshot.room.status !== "waiting") {
      router.replace(`/game/${snapshot.room.id}`);
    }
  }, [router, snapshot]);

  async function updateMe(patch: Record<string, unknown>) {
    setActionError("");
    setIsSaving(true);

    try {
      const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/me`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await response.json()) as RoomUpdateResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível salvar suas escolhas.");
      }

      if (data.room?.status !== "waiting" && data.room?.id) {
        router.replace(`/game/${data.room.id}`);
        return;
      }

      await refresh();
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível salvar suas escolhas.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function saveFaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void updateMe({ factionName: formData.get("factionName") });
  }

  if (isLoading && !snapshot) {
    return (
      <div className="rounded-3xl border border-[#17372d]/10 bg-[#faf8f2] p-8 text-sm text-[#64756f] shadow-[0_18px_50px_rgba(42,55,50,0.07)]">
        Conectando à sala…
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="rounded-3xl border border-[#a33c33]/20 bg-[#fff8f5] p-8 text-sm text-[#a33c33]">
        {syncError || "Não foi possível encontrar esta sala."}
      </div>
    );
  }

  const { me, players, room } = snapshot;
  const readyPlayers = players.filter((player) => player.isReady).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
      <section className="rounded-3xl border border-[#17372d]/10 bg-[#faf8f2] p-6 shadow-[0_18px_50px_rgba(42,55,50,0.07)] sm:p-8">
        <div className="flex flex-col gap-4 border-b border-[#17372d]/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9b7a27]">
              Lobby sincronizada
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Sala {room.code}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#687871]">
              A partida começa quando ao menos 2 jogadores estiverem prontos.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#e3eee6] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#326347]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#3f8b68]" />
            Atualiza a cada 1 s
          </span>
        </div>

        <div className="mt-7">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#52645e]">
              Jogadores ({players.length}/6)
            </h2>
            <span className="text-xs font-semibold text-[#74847d]">
              {readyPlayers} prontos
            </span>
          </div>

          <ul className="mt-4 space-y-3">
            {players.map((player) => (
              <PlayerCard key={player.id} player={player} />
            ))}
          </ul>
        </div>

        {syncError ? (
          <p className="mt-5 rounded-xl bg-[#fff0eb] px-4 py-3 text-sm text-[#a33c33]">
            {syncError}
          </p>
        ) : null}
      </section>

      <aside className="rounded-3xl bg-[#12392f] p-6 text-white shadow-[0_18px_50px_rgba(19,57,47,0.16)] sm:p-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9eb8ae]">
          Suas escolhas
        </p>

        <form onSubmit={saveFaction} className="mt-5">
          <label htmlFor="faction-name" className="text-sm font-semibold">
            Nome da facção
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="faction-name"
              name="factionName"
              key={me.factionName}
              defaultValue={me.factionName}
              maxLength={32}
              disabled={isSaving}
              className="h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/8 px-3 text-sm text-white outline-none placeholder:text-[#9eb8ae] focus:border-[#e4b94f] focus:ring-2 focus:ring-[#e4b94f]/30 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-white px-3 text-xs font-bold uppercase tracking-wider text-[#12392f] transition hover:bg-[#f2eddf] disabled:opacity-60"
            >
              Salvar
            </button>
          </div>
        </form>

        <div className="mt-7">
          <p className="text-sm font-semibold">Cor da facção</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {PLAYER_COLORS.map((color) => {
              const takenByAnotherPlayer = players.some(
                (player) => !player.isMe && player.color === color.value,
              );
              const isCurrentColor = me.color === color.value;

              return (
                <button
                  key={color.value}
                  type="button"
                  title={takenByAnotherPlayer ? `${color.label} indisponível` : color.label}
                  disabled={isSaving || takenByAnotherPlayer || isCurrentColor}
                  onClick={() => void updateMe({ color: color.value })}
                  className={`flex h-12 items-center justify-center gap-2 rounded-xl border text-xs font-bold transition ${
                    isCurrentColor
                      ? "border-[#e4b94f] bg-white/12 text-white"
                      : "border-white/12 bg-white/5 text-[#d7e4de] hover:bg-white/12"
                  } disabled:cursor-not-allowed disabled:opacity-35`}
                >
                  <span
                    className="h-3 w-3 rounded-full ring-2 ring-white/20"
                    style={{ backgroundColor: color.hex }}
                  />
                  {color.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-5 text-[#9eb8ae]">
            Alterar a facção ou a cor remove o status de pronto.
          </p>
        </div>

        <button
          type="button"
          disabled={isSaving}
          onClick={() => void updateMe({ isReady: !me.isReady })}
          className={`mt-7 flex h-13 w-full items-center justify-center rounded-xl text-xs font-bold uppercase tracking-[0.14em] transition disabled:opacity-60 ${
            me.isReady
              ? "bg-[#e4b94f] text-[#12392f] hover:bg-[#f1ca68]"
              : "border border-white/18 bg-white text-[#12392f] hover:bg-[#f2eddf]"
          }`}
        >
          {me.isReady ? "Pronto" : "Marcar como pronto"}
        </button>

        {actionError ? (
          <p className="mt-4 rounded-xl bg-[#842f32]/35 px-3 py-2 text-sm text-[#ffd2c9]">
            {actionError}
          </p>
        ) : null}
      </aside>
    </div>
  );
}

function PlayerCard({ player }: { player: LobbyPlayer }) {
  const color = colorByValue(player.color);

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-[#17372d]/8 bg-white p-4">
      <span
        className="h-10 w-10 shrink-0 rounded-xl ring-4 ring-[#17372d]/5"
        style={{ backgroundColor: color?.hex }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{player.factionName}</p>
          {player.isMe ? (
            <span className="rounded-full bg-[#e6eee8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#47725a]">
              Você
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-[#74847d]">{color?.label}</p>
      </div>
      <span
        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
          player.isReady
            ? "bg-[#e2f0e4] text-[#326347]"
            : "bg-[#f2e9d7] text-[#8a6a27]"
        }`}
      >
        {player.isReady ? "Pronto" : "Aguardando"}
      </span>
    </li>
  );
}
