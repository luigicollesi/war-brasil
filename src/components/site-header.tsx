import Link from "next/link";

type SiteHeaderProps = {
  theme?: "light" | "dark";
  roomCode?: string;
};

export function SiteHeader({ theme = "light", roomCode }: SiteHeaderProps) {
  const isDark = theme === "dark";

  return (
    <header
      className={`relative z-20 border-b ${
        isDark
          ? "border-white/10 bg-[#071c18]/90 text-[#f7f2e7]"
          : "border-[#17372d]/10 bg-[#f7f4ec]/90 text-[#14241f]"
      } backdrop-blur`}
    >
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d3a934]"
          aria-label="WAR Brasil — início"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full border border-[#d3a934]/50 bg-[#d3a934]/10 font-serif text-lg font-bold text-[#d3a934]">
            W
          </span>
          <span className="text-sm font-black tracking-[0.16em]">
            WAR <span className="text-[#d3a934]">BRASIL</span>
          </span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-5">
          {roomCode ? (
            <span
              className={`hidden rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider sm:inline-flex ${
                isDark
                  ? "border-white/15 text-[#b9c8c1]"
                  : "border-[#17372d]/15 text-[#52645e]"
              }`}
            >
              Sala {roomCode}
            </span>
          ) : null}
          <Link
            href="/matchmaking"
            className={`text-xs font-bold uppercase tracking-[0.14em] transition ${
              isDark
                ? "text-[#b9c8c1] hover:text-white"
                : "text-[#52645e] hover:text-[#14241f]"
            }`}
          >
            Salas
          </Link>
        </div>
      </div>
    </header>
  );
}
