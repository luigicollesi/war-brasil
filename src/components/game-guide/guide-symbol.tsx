import Image from "next/image";

export function Symbol({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="wb-guide-symbol">
      <Image src={src} alt={alt} width={28} height={28} />
    </span>
  );
}
