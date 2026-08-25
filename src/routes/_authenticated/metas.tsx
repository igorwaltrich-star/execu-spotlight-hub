import { createFileRoute } from "@tanstack/react-router";
import { EmDesenvolvimento } from "@/components/em-desenvolvimento";

export const Route = createFileRoute("/_authenticated/metas")({
  component: MetasPage,
});

function MetasPage() {
  return (
    <EmDesenvolvimento
      titulo="Metas"
      descricao="Metas com atingimento automático e histórico semanal."
      fase="Fase 2B"
    />
  );
}
