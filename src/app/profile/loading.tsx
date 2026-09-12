import { ProfileBoundaryState } from "@/src/components/profile/profile-boundary-state";
import { ProfileSceneBridge } from "@/src/components/profile/profile-command-shell";

export default function ProfileLoading() {
  return (
    <ProfileSceneBridge>
      <ProfileBoundaryState
        variant="loading"
        eyebrow="Consultando arquivo"
        title="Recuperando registro de comando"
        description="A identidade permanece sem valores simulados enquanto a fonte de dados é consultada."
      />
    </ProfileSceneBridge>
  );
}
