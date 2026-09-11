import styles from "./profile-environment-state.module.css";

export function ProfileEnvironmentState() {
  return (
    <div className={styles.environmentState} aria-label="Estado de apresentação do perfil">
      <span className={styles.webglLoading}>Fallback 2D ativo durante preparação da cena</span>
      <span className={styles.webglReady}>Cena 3D disponível; conteúdo HTML preservado</span>
      <span className={styles.webglFallback}>Fallback 2D ativo; conteúdo HTML preservado</span>
      <span className={styles.motionDefault}>Movimento padrão ativo</span>
      <span className={styles.motionReduced}>Movimento reduzido ativo</span>
    </div>
  );
}
