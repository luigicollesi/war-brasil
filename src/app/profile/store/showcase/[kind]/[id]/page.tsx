import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import type { StoreShowcaseView } from "@/src/lib/economy/store-showcase";
import {
  resolveStoreShowcaseView,
  type StoreShowcaseKind,
} from "@/src/lib/economy/store-showcase";
import { auth } from "@/src/lib/server/auth/auth";
import {
  EconomyServiceError,
  getEconomyStorefront,
} from "@/src/lib/server/economy/economy-service";
import { getOwnCommanderProfile } from "@/src/lib/server/profile/profile-service";

type StoreShowcasePageProps = Readonly<{
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ item?: string | string[] }>;
}>;

export const metadata: Metadata = {
  title: "Expositor · Intendência",
  description: "Inspeção tática de cosméticos da Intendência.",
  robots: { index: false, follow: false },
};

function isShowcaseKind(value: string): value is StoreShowcaseKind {
  return value === "offer" || value === "collection";
}

function StoreShowcase({ showcase }: { showcase: StoreShowcaseView }) {
  const selected = showcase.items.find((item) => item.id === showcase.selectedItemId);

  return (
    <main aria-label="Expositor da Intendência">
      <Link href="/profile/store">Voltar à Intendência</Link>
      <p>{showcase.kind === "collection" ? "COLEÇÃO // EXPOSIÇÃO" : "INSPEÇÃO // ARSENAL"}</p>
      <h1>{showcase.title}</h1>
      <p>{selected?.name ?? showcase.title}</p>
    </main>
  );
}

export default async function StoreShowcasePage({
  params,
  searchParams,
}: StoreShowcasePageProps) {
  await connection();
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });

  if (!session) redirect("/");

  const profile = await getOwnCommanderProfile(session.user.id);
  if (!profile) redirect("/profile");

  const { kind, id } = await params;
  if (!isShowcaseKind(kind)) notFound();

  let storefront;
  try {
    storefront = await getEconomyStorefront(session.user.id);
  } catch (error) {
    if (
      error instanceof EconomyServiceError &&
      error.code === "ECONOMY_COMMANDER_MISSING"
    ) {
      redirect("/profile");
    }
    throw error;
  }

  const query = await searchParams;
  const requestedItem = Array.isArray(query.item) ? query.item[0] : query.item;
  const showcase = resolveStoreShowcaseView(storefront, kind, id, requestedItem ?? null);
  if (!showcase) notFound();

  return <StoreShowcase showcase={showcase} />;
}
