import { StoreCategoryBoundary } from "@/src/components/profile/v4/store-category-boundary";

export default function StoreCategoryLoading() {
  return (
    <StoreCategoryBoundary
      variant="loading"
      eyebrow="CATÁLOGO // SINCRONIZAÇÃO"
      title="Preparando exposição"
      description="Itens, propriedade e preços autoritativos estão sendo carregados."
    />
  );
}
