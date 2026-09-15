import { ProfileV4Boundary } from "@/src/components/profile/v4/profile-v4-boundary";

export default function ProfileLoading() {
  return (
    <ProfileV4Boundary
      variant="loading"
      eyebrow="SINCRONIZAÇÃO // PERFIL"
      title="Recuperando registro de comando"
      description="Identidade, Arsenal e Tesouraria permanecem sem valores simulados enquanto as fontes autoritativas são consultadas."
    />
  );
}
