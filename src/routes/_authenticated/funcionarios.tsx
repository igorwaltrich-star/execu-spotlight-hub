import { createFileRoute } from "@tanstack/react-router";
import { FuncionariosView } from "@/components/dho/funcionarios-view";
import { Restrito } from "@/components/acesso-restrito";

export const Route = createFileRoute("/_authenticated/funcionarios")({
  component: () => (
    <Restrito papeis={["gestor", "coordenador"]}>
      <FuncionariosView />
    </Restrito>
  ),
});
