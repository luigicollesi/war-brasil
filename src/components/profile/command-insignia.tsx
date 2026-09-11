import styles from "./command-insignia.module.css";

type CommandInsigniaProps = {
  displayName: string;
};

function initialsFrom(displayName: string) {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR"))
    .join("");
}

export function CommandInsignia({ displayName }: CommandInsigniaProps) {
  const initials = initialsFrom(displayName) || "WB";

  return (
    <div
      className={styles.insignia}
      role="img"
      aria-label={`Insígnia de comando de ${displayName}`}
    >
      <span className={styles.outerRing} aria-hidden="true" />
      <span className={styles.middleRing} aria-hidden="true" />
      <span className={styles.crosshair} aria-hidden="true" />
      <span className={styles.shield} aria-hidden="true">
        <svg viewBox="0 0 120 142" focusable="false">
          <path
            d="M60 5 108 23v43c0 32-17 56-48 70C29 122 12 98 12 66V23L60 5Z"
            fill="currentColor"
          />
          <path
            d="M60 17 97 31v35c0 25-12 44-37 57-25-13-37-32-37-57V31L60 17Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity=".32"
          />
        </svg>
      </span>
      <span className={styles.initials} aria-hidden="true">
        {initials}
      </span>
      <span className={styles.axisMark} aria-hidden="true">BR</span>
    </div>
  );
}
