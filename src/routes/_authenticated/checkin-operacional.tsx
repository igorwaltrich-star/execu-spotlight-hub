import { createFileRoute } from "@tanstack/react-router";
import { EmDesenvolvimento } from "@/components/em-desenvolvimento";

export const Route = createFileRoute("/_authenticated/checkin-operacional")({
  component: CheckinOpPage,
});

function CheckinOpPage() {
  return (
    <EmDesenvolvimento
      titulo="Check IN Operacional"
      descricao="Status diário/semanal por operação com histórico e alertas."
      fase="Fase 1G"
    />
  );
}
