import { createFileRoute } from "@tanstack/react-router";
import { GestaoFinanceiraView } from "@/components/financeiro/gestao-financeira-view";
import { Restrito } from "@/components/acesso-restrito";

export const Route = createFileRoute("/_authenticated/gestao-financeira")({
  head: () => ({
    meta: [
      { title: "Gestão Financeira | Execu Spotlight" },
      { name: "description", content: "Indicadores financeiros, fechamentos pendentes e resumo gerencial das operações." },
      { property: "og:title", content: "Gestão Financeira | Execu Spotlight" },
      { property: "og:description", content: "Indicadores financeiros, fechamentos pendentes e resumo gerencial das operações." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Restrito papeis={["gestor", "coordenador", "supervisor"]}>
      <GestaoFinanceiraView />
    </Restrito>
  ),
});
