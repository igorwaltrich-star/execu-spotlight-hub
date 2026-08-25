import { createFileRoute } from "@tanstack/react-router";
import { RelatoriosView } from "@/components/dho/relatorios-view";
import { Restrito } from "@/components/acesso-restrito";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: () => (
    <Restrito papeis={["gestor", "coordenador"]}>
      <RelatoriosView />
    </Restrito>
  ),
});
