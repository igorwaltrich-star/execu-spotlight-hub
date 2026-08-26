import { createFileRoute } from "@tanstack/react-router";
import { InsightsView } from "@/components/operacional/insights-view";
import { Restrito } from "@/components/acesso-restrito";

export const Route = createFileRoute("/_authenticated/insights")({
  component: () => (
    <Restrito papeis={["gestor", "coordenador", "supervisor"]}>
      <InsightsView />
    </Restrito>
  ),
});
