import { createFileRoute } from "@tanstack/react-router";
import { EmDesenvolvimento } from "@/components/em-desenvolvimento";

export const Route = createFileRoute("/_authenticated/equipes")({
  component: EquipesPage,
});

function EquipesPage() {
  return (
    <EmDesenvolvimento
      titulo="Equipes"
      descricao="Cadastro e composição de equipes com gestores e membros."
      fase="Fase 2A"
    />
  );
}
