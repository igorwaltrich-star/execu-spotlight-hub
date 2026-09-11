import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/cadastro-operacional-view";
import { IndicadoresPanel } from "@/components/operacional/paineis/indicadores-panel";
import { ScorecardOperacaoPanel } from "@/components/operacional/paineis/scorecard-operacao-panel";
import { ContribuicaoColaboradorPanel } from "@/components/operacional/paineis/contribuicao-colaborador-panel";
import { RiscosOperacionaisPanel } from "@/components/operacional/paineis/riscos-operacionais-panel";

export function PaineisOperacionaisView() {
  return (
    <div className="pb-6">
      <PageHeader
        title="Painéis Operacionais"
        description="Indicadores, scorecard por operação, contribuição por colaborador e riscos operacionais"
      />
      <div className="p-6">
        <Tabs defaultValue="indicadores" className="w-full">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
            <TabsTrigger value="scorecard">Scorecard por Operação</TabsTrigger>
            <TabsTrigger value="contribuicao">Contribuição por Colaborador</TabsTrigger>
            <TabsTrigger value="riscos">Riscos Operacionais</TabsTrigger>
          </TabsList>

          <TabsContent value="indicadores" className="mt-4">
            <IndicadoresPanel />
          </TabsContent>
          <TabsContent value="scorecard" className="mt-4">
            <ScorecardOperacaoPanel />
          </TabsContent>
          <TabsContent value="contribuicao" className="mt-4">
            <ContribuicaoColaboradorPanel />
          </TabsContent>
          <TabsContent value="riscos" className="mt-4">
            <RiscosOperacionaisPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
