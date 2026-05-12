import { createFileRoute } from "@tanstack/react-router";
import { CadastroColaboradoresView } from "@/components/cadastro-colaboradores-view";

export const Route = createFileRoute("/_authenticated/colaboradores")({
  component: CadastroColaboradoresView,
});
