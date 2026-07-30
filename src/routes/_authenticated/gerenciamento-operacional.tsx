import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/cadastro-operacional-view";
import { CadastroColaboradores } from "@/components/gestao/cadastro-colaboradores";
import { MatrizLideranca } from "@/components/gestao/matriz-lideranca";
import { NavySeal } from "@/components/gestao/navy-seal";
import { FerramentasGestao } from "@/components/gestao/ferramentas-gestao";

export const Route = createFileRoute("/_authenticated/gerenciamento-operacional")({
  component: GerenciamentoOperacionalPage,
});

function GerenciamentoOperacionalPage() {
  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Gerenciamento Operacional"
        description="Performance, equipe e ferramentas de gestão"
      />

      <Tabs defaultValue="colaboradores" className="w-full">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
          <TabsTrigger value="matriz">Matriz Liderança</TabsTrigger>
          <TabsTrigger value="navyseal">NavySeal</TabsTrigger>
          <TabsTrigger value="ferramentas">Ferramentas de Gestão</TabsTrigger>
        </TabsList>

        <TabsContent value="colaboradores" className="mt-4">
          <CadastroColaboradores />
        </TabsContent>
        <TabsContent value="matriz" className="mt-4">
          <MatrizLideranca />
        </TabsContent>
        <TabsContent value="navyseal" className="mt-4">
          <NavySeal />
        </TabsContent>
        <TabsContent value="ferramentas" className="mt-4">
          <FerramentasGestao />
        </TabsContent>
      </Tabs>

    </div>
  );
}
