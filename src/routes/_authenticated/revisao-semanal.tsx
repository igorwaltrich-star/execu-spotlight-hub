import { createFileRoute } from "@tanstack/react-router";
import { EmDesenvolvimento } from "@/components/em-desenvolvimento";

export const Route = createFileRoute("/_authenticated/revisao-semanal")({
  component: RevisaoSemanalPage,
});

function RevisaoSemanalPage() {
  return (
    <EmDesenvolvimento
      titulo="Revisão Semanal"
      descricao="Fluxo guiado de revisão com classificação e justificativas."
      fase="Fase 2C"
    />
  );
}
