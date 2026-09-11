import { createFileRoute } from "@tanstack/react-router";
import { PaineisOperacionaisView } from "@/components/operacional/paineis-view";

export const Route = createFileRoute("/_authenticated/paineis-operacionais")({
  head: () => ({
    meta: [
      { title: "Painéis Operacionais | Grupo Pinho" },
      {
        name: "description",
        content:
          "Indicadores operacionais, scorecard por operação, contribuição por colaborador e gestão de riscos priorizados.",
      },
      { property: "og:title", content: "Painéis Operacionais | Grupo Pinho" },
      {
        property: "og:description",
        content: "Indicadores, scorecard por operação, contribuição por colaborador e riscos operacionais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaineisOperacionaisView,
});
