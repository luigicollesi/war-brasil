import type { Metadata } from "next";
import { DoctrineExperience } from "@/src/components/doctrine/doctrine-experience";
import {
  buildDoctrinePresentation,
  isDoctrineChapterSlug,
} from "@/src/lib/doctrine-presentation";

export const metadata: Metadata = {
  title: "Doutrina",
  description:
    "Doutrina oficial do WAR Brasil: preparação, objetivos, reforços, ataque, conquista, movimentação, cartas, barreiras e anomalias.",
  alternates: {
    canonical: "/rules",
  },
};

type RulesPageProps = {
  searchParams: Promise<{
    chapter?: string | string[];
  }>;
};

export default async function RulesPage({ searchParams }: RulesPageProps) {
  const presentation = buildDoctrinePresentation();
  const params = await searchParams;
  const rawChapter = Array.isArray(params.chapter)
    ? params.chapter[0]
    : params.chapter;
  const initialChapter = isDoctrineChapterSlug(rawChapter)
    ? rawChapter
    : presentation.chapters[0].slug;

  return (
    <DoctrineExperience
      presentation={presentation}
      initialChapter={initialChapter}
    />
  );
}
