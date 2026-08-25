import { createFileRoute } from "@tanstack/react-router";
import { EmDesenvolvimento } from "@/components/em-desenvolvimento";

export const Route = createFileRoute("/_authenticated/produtividade")({
  component: ProdutividadePage,
});

function ProdutividadePage() {
  return (
    <EmDesenvolvimento
      titulo="Produtividade por Pessoa"
      descricao="Registro individual de produtividade com FTE proporcional e rotation."
      fase="Fase 1C"
    />
  );
}
