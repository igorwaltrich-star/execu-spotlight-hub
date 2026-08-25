import { createFileRoute } from "@tanstack/react-router";
import { AtividadesView } from "@/components/dho/atividades-view";

export const Route = createFileRoute("/_authenticated/atividades")({
  component: AtividadesView,
});
