import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CadastroOperacionalView } from "@/components/cadastro-operacional-view";
import { SlaView } from "@/components/sla-view";
import { UNIDADES, BOSCH_PLANTAS } from "@/lib/constants";

const MIDEA_UNIDADES = UNIDADES.filter((u) => u.grupo === "midea").map((u) => ({
  key: u.key,
  label: u.label,
}));

export const Route = createFileRoute("/_authenticated/cadastro")({
  component: CadastroOperacionalPage,
});

function CadastroOperacionalPage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cadastro Operacional</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registro mensal de operações e indicadores de SLA
        </p>
      </div>

      <Tabs defaultValue="registro" className="w-full">
        <TabsList>
          <TabsTrigger value="registro">Registro Mensal</TabsTrigger>
          <TabsTrigger value="sla-midea">SLA Midea</TabsTrigger>
          <TabsTrigger value="sla-bosch">SLA Bosch</TabsTrigger>
        </TabsList>

        <TabsContent value="registro" className="mt-4">
          <CadastroOperacionalView hideHeader />
        </TabsContent>

        <TabsContent value="sla-midea" className="mt-4">
          <SlaView
            table="sla_midea"
            title="SLA — Midea"
            description="Indicadores de SLA do cliente Midea por operação."
            unidadeOptions={MIDEA_UNIDADES}
            hideHeader
            fields={[
              { key: "start_up", label: "Start-up" },
              { key: "otcc", label: "OTCC" },
              { key: "otd", label: "OTD" },
              { key: "sotd", label: "SOTD" },
            ]}
          />
        </TabsContent>

        <TabsContent value="sla-bosch" className="mt-4">
          <SlaView
            table="sla_bosch"
            title="SLA — Bosch"
            description="Indicadores de SLA do cliente Bosch por planta."
            unidadeOptions={BOSCH_PLANTAS}
            unidadeColumn="planta"
            unidadeLabel="Planta"
            hideHeader
            fields={[
              { key: "dig_conf", label: "Digitação/Conferência" },
              { key: "start_up", label: "Registro DI/DUIMP" },
              { key: "otcc", label: "Liberação Transporte" },
              { key: "pinho", label: "Pinho" },
              { key: "proc_aereos", label: "Processos Aéreos", kind: "number" },
              { key: "proc_maritimos", label: "Processos Marítimos", kind: "number" },
              { key: "proc_canal_verde", label: "Canal Verde", kind: "number" },
              { key: "proc_canal_vermelho", label: "Canal Vermelho", kind: "number" },
              { key: "tm_dig_conf_h", label: "T.M. Dig/Conf", kind: "number", unit: "h" },
              { key: "tm_registro_dias", label: "T.M. Registro", kind: "number", unit: "dias" },
              { key: "tm_liberacao_dias", label: "T.M. Liberação Transp", kind: "number", unit: "dias" },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
