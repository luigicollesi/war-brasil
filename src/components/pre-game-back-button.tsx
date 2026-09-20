import Link from "next/link";
import styles from "./pre-game-back-button.module.css";

type PreGameBackButtonProps = {
  href: string;
  label?: string;
  className?: string;
};

export function PreGameBackButton({
  href,
  label = "Voltar",
  className,
}: PreGameBackButtonProps) {
  const classes = className ? `${styles.button} ${className}` : styles.button;

  return (
    <Link href={href} className={classes} aria-label={label}>
      <span className={styles.icon} aria-hidden="true">
        ←
      </span>
      <span>{label}</span>
    </Link>
  );
}
