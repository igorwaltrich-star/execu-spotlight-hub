import { createFileRoute } from "@tanstack/react-router";
import { BancoHorasView } from "@/components/operacional/banco-horas-view";
import { Restrito } from "@/components/acesso-restrito";

export const Route = createFileRoute("/_authenticated/banco-horas")({
  component: () => (
    <Restrito papeis={["gestor", "coordenador", "supervisor"]}>
      <BancoHorasView />
    </Restrito>
  ),
});
