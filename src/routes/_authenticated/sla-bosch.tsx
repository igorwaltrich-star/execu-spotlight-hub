import { createFileRoute } from "@tanstack/react-router";
import { SlaView } from "@/components/sla-view";
import { BOSCH_PLANTAS } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/sla-bosch")({
  component: () => (
    <SlaView
      table="sla_bosch"
      title="SLA — Bosch"
      description="Indicadores de SLA do cliente Bosch por planta."
      unidadeOptions={BOSCH_PLANTAS}
      unidadeColumn="planta"
      unidadeLabel="Planta"
      fields={[
        { key: "dig_conf", label: "Digitação/Conferência" },
        { key: "start_up", label: "Registro DI/DUIMP" },
        { key: "otcc", label: "Liberação Transporte" },
        { key: "desvios", label: "Desvios" },
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
  ),
});
