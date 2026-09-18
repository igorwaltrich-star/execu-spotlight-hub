import { createFileRoute } from "@tanstack/react-router";
import { GestaoFinanceiraView } from "@/components/financeiro/gestao-financeira-view";
import { Restrito } from "@/components/acesso-restrito";

export const Route = createFileRoute("/_authenticated/gestao-financeira")({
  component: () => (
    <Restrito papeis={["gestor", "coordenador", "supervisor"]}>
      <GestaoFinanceiraView />
    </Restrito>
  ),
});
