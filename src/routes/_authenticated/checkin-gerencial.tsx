import { createFileRoute } from "@tanstack/react-router";
import { EmDesenvolvimento } from "@/components/em-desenvolvimento";

export const Route = createFileRoute("/_authenticated/checkin-gerencial")({
  component: CheckinGerencialPage,
});

function CheckinGerencialPage() {
  return (
    <EmDesenvolvimento
      titulo="Check IN Gerencial"
      descricao="Reunião estruturada com pauta, encaminhamentos e histórico."
      fase="Fase 2D"
    />
  );
}
