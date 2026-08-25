import { createFileRoute } from "@tanstack/react-router";
import { EmDesenvolvimento } from "@/components/em-desenvolvimento";

export const Route = createFileRoute("/_authenticated/custo-operacional")({
  component: CustoOperacionalPage,
});

function CustoOperacionalPage() {
  return (
    <EmDesenvolvimento
      titulo="Custo Operacional"
      descricao="Upload de planilha e cadastro manual de custo por colaborador."
      fase="Fase 1F"
    />
  );
}
