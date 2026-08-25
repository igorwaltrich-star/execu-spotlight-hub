import { createFileRoute } from "@tanstack/react-router";
import { CustoOperacionalView } from "@/components/operacional/custo-operacional-view";
import { Restrito } from "@/components/acesso-restrito";

export const Route = createFileRoute("/_authenticated/custo-operacional")({
  component: () => (
    <Restrito papeis={["gestor", "coordenador"]}>
      <CustoOperacionalView />
    </Restrito>
  ),
});
