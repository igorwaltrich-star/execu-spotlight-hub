import { createFileRoute } from "@tanstack/react-router";
import { ProdutividadeView } from "@/components/operacional/produtividade-view";

export const Route = createFileRoute("/_authenticated/produtividade")({
  component: ProdutividadeView,
});
