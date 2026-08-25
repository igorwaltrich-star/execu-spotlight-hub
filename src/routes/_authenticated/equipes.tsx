import { createFileRoute } from "@tanstack/react-router";
import { EquipesView } from "@/components/dho/equipes-view";
import { Restrito } from "@/components/acesso-restrito";

export const Route = createFileRoute("/_authenticated/equipes")({
  component: () => (
    <Restrito papeis={["gestor", "coordenador"]}>
      <EquipesView />
    </Restrito>
  ),
});
