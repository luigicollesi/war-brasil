import { ProfileBoundaryState } from "@/src/components/profile/profile-boundary-state";
import { WarShell } from "@/src/components/war-shell";

export default function ProfileLoading() {
  return (
    <WarShell title="Salão de Comando" backHref="/" backLabel="Início">
      <ProfileBoundaryState
        variant="loading"
        eyebrow="Consultando arquivo"
        title="Recuperando registro de comando"
        description="A identidade permanece sem valores simulados enquanto a fonte de dados é consultada. A arquitetura do Salão continua disponível durante a leitura."
      />
    </WarShell>
  );
}
