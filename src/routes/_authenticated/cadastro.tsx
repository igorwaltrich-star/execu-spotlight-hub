import { createFileRoute } from "@tanstack/react-router";
import { CadastroOperacionalView } from "@/components/cadastro-operacional-view";

export const Route = createFileRoute("/_authenticated/cadastro")({
  head: () => ({
    meta: [
      { title: "Cadastro Operacional | Execu Spotlight Hub" },
      { name: "description", content: "Lançamentos mensais de volume, pessoas e produtividade por operação." },
      { property: "og:title", content: "Cadastro Operacional | Execu Spotlight Hub" },
      { property: "og:description", content: "Histórico de volume, pessoas e produtividade por operação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CadastroOperacionalPage,
});

function CadastroOperacionalPage() {
  return <CadastroOperacionalView />;
}
