import { createFileRoute } from "@tanstack/react-router";
import { EmDesenvolvimento } from "@/components/em-desenvolvimento";

export const Route = createFileRoute("/_authenticated/atividades")({
  component: AtividadesPage,
});

function AtividadesPage() {
  return (
    <EmDesenvolvimento
      titulo="Atividades"
      descricao="Gestão de atividades recorrentes e com prazo definido."
      fase="Fase 2B"
    />
  );
}
