import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/cadastro-operacional-view";
import { PerformanceOperacional } from "@/components/gestao/performance-operacional";
import { CadastroColaboradores } from "@/components/gestao/cadastro-colaboradores";
import { EscalaHomeOffice } from "@/components/gestao/escala-home-office";
import { ControleFerias } from "@/components/gestao/controle-ferias";
import { MatrizLideranca } from "@/components/gestao/matriz-lideranca";
import { NavySeal } from "@/components/gestao/navy-seal";
import { PDI } from "@/components/gestao/pdi";
import { IndicadoresPerformance } from "@/components/gestao/indicadores-performance";
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

      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="performance">Performance (IA)</TabsTrigger>
          <TabsTrigger value="indicadores">Indicadores de Performance</TabsTrigger>
          <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
          <TabsTrigger value="home-office">Home Office</TabsTrigger>
          <TabsTrigger value="ferias">Férias</TabsTrigger>
          <TabsTrigger value="matriz">Matriz Liderança</TabsTrigger>
          <TabsTrigger value="navyseal">NavySeal</TabsTrigger>
          <TabsTrigger value="pdi">PDI</TabsTrigger>
          <TabsTrigger value="ferramentas">Ferramentas de Gestão</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="mt-4">
          <PerformanceOperacional />
        </TabsContent>
        <TabsContent value="indicadores" className="mt-4">
          <IndicadoresPerformance />
        </TabsContent>
        <TabsContent value="colaboradores" className="mt-4">
          <CadastroColaboradores />
        </TabsContent>
        <TabsContent value="home-office" className="mt-4">
          <EscalaHomeOffice />
        </TabsContent>
        <TabsContent value="ferias" className="mt-4">
          <ControleFerias />
        </TabsContent>
        <TabsContent value="matriz" className="mt-4">
          <MatrizLideranca />
        </TabsContent>
        <TabsContent value="navyseal" className="mt-4">
          <NavySeal />
        </TabsContent>
        <TabsContent value="pdi" className="mt-4">
          <PDI />
        </TabsContent>
        <TabsContent value="ferramentas" className="mt-4">
          <FerramentasGestao />
        </TabsContent>
      </Tabs>
    </div>
  );
}
