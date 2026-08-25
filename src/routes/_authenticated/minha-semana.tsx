import { createFileRoute } from "@tanstack/react-router";
import { EmDesenvolvimento } from "@/components/em-desenvolvimento";

export const Route = createFileRoute("/_authenticated/minha-semana")({
  component: MinhaSemanaPage,
});

function MinhaSemanaPage() {
  return (
    <EmDesenvolvimento
      titulo="Minha Semana"
      descricao="Visão pessoal de atividades, metas e PDI da semana atual."
      fase="Fase 2B"
    />
  );
}
