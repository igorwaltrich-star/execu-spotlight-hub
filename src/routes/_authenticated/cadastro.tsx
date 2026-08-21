import { createFileRoute } from "@tanstack/react-router";
import { CadastroOperacionalView } from "@/components/cadastro-operacional-view";

export const Route = createFileRoute("/_authenticated/cadastro")({
  component: CadastroOperacionalPage,
});

function CadastroOperacionalPage() {
  return <CadastroOperacionalView />;
}
