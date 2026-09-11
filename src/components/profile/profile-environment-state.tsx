import styles from "./profile-environment-state.module.css";

export function ProfileEnvironmentState() {
  return (
    <div className={styles.environmentState} aria-label="Estado de apresentação do perfil">
      <span>Conteúdo funcional independente de WebGL</span>
      <span className={styles.motionDefault}>Movimento padrão ativo</span>
      <span className={styles.motionReduced}>Movimento reduzido ativo</span>
    </div>
  );
}
