import { createFileRoute } from "@tanstack/react-router";
import { EmDesenvolvimento } from "@/components/em-desenvolvimento";

export const Route = createFileRoute("/_authenticated/funcionarios")({
  component: FuncionariosPage,
});

function FuncionariosPage() {
  return (
    <EmDesenvolvimento
      titulo="Funcionários"
      descricao="Cadastro completo de colaboradores com perfis e permissões."
      fase="Fase 2A"
    />
  );
}
