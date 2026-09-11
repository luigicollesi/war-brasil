import { CommandShell } from "@/src/components/pre-game/foundation";
import { ProfileBoundaryState } from "@/src/components/profile/profile-boundary-state";
import { WarShell } from "@/src/components/war-shell";

export default function ProfileLoading() {
  return (
    <CommandShell
      intent={{ mode: "profile", focus: "insignia", conflictLevel: 0 }}
      chrome={false}
      sectionLabel="Salão de Comando"
    >
      <WarShell title="Salão de Comando" backHref="/" backLabel="Início">
        <ProfileBoundaryState
          variant="loading"
          eyebrow="Consultando arquivo"
          title="Recuperando registro de comando"
          description="A identidade permanece sem valores simulados enquanto a fonte de dados é consultada."
        />
      </WarShell>
    </CommandShell>
  );
}
