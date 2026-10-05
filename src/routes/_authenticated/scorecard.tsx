import { createFileRoute } from "@tanstack/react-router";
import { ScorecardView } from "@/components/dho/scorecard-view";
import { Restrito } from "@/components/acesso-restrito";

export const Route = createFileRoute("/_authenticated/scorecard")({
  head: () => ({
    meta: [
      { title: "Scorecard | Execu Spotlight" },
      { name: "description", content: "Ciclos de avaliação, critérios e resultados de desempenho da equipe." },
      { property: "og:title", content: "Scorecard | Execu Spotlight" },
      { property: "og:description", content: "Ciclos de avaliação, critérios e resultados de desempenho da equipe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Restrito papeis={["gestor", "coordenador", "supervisor"]}>
      <ScorecardView />
    </Restrito>
  ),
});
