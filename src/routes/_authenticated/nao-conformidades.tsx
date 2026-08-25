import { createFileRoute } from "@tanstack/react-router";
import { EmDesenvolvimento } from "@/components/em-desenvolvimento";

export const Route = createFileRoute("/_authenticated/nao-conformidades")({
  component: NaoConformidadesPage,
});

function NaoConformidadesPage() {
  return (
    <EmDesenvolvimento
      titulo="Não Conformidades"
      descricao="Registro de ocorrências com custo, referências Pinho/Cliente/OC e controle financeiro."
      fase="Fase 1D"
    />
  );
}
