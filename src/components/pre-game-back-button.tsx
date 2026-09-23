import Link from "next/link";
import styles from "./pre-game-back-button.module.css";

type PreGameBackButtonProps = {
  href?: string;
  label?: string;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export function PreGameBackButton({
  href,
  label = "Voltar",
  className,
  onClick,
  disabled = false,
}: PreGameBackButtonProps) {
  const classes = className ? `${styles.button} ${className}` : styles.button;
  const content = (
    <>
      <span className={styles.icon} aria-hidden="true">
        ←
      </span>
      <span>{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
      >
        {content}
      </button>
    );
  }

  if (!href) {
    throw new Error("PreGameBackButton exige href ou onClick.");
  }

  return (
    <Link href={href} className={classes} aria-label={label}>
      {content}
    </Link>
  );
}
