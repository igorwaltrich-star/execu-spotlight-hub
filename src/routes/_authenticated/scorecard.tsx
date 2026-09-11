import { createFileRoute } from "@tanstack/react-router";
import { ScorecardView } from "@/components/dho/scorecard-view";
import { Restrito } from "@/components/acesso-restrito";

export const Route = createFileRoute("/_authenticated/scorecard")({
  component: () => (
    <Restrito papeis={["gestor", "coordenador", "supervisor"]}>
      <ScorecardView />
    </Restrito>
  ),
});
