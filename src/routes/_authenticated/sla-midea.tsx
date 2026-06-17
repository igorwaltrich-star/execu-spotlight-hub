import { createFileRoute } from "@tanstack/react-router";
import { SlaView } from "@/components/sla-view";
import { UNIDADES } from "@/lib/constants";

const MIDEA_UNIDADES = UNIDADES.filter((u) => u.grupo === "midea").map((u) => ({
  key: u.key,
  label: u.label,
}));

export const Route = createFileRoute("/_authenticated/sla-midea")({
  component: () => (
    <SlaView
      table="sla_midea"
      title="SLA — Midea"
      description="Indicadores de SLA do cliente Midea por operação."
      unidadeOptions={MIDEA_UNIDADES}
      fields={[
        { key: "start_up", label: "Start-up" },
        { key: "otcc", label: "OTCC" },
        { key: "otd", label: "OTD" },
        { key: "sotd", label: "SOTD" },
      ]}
    />
  ),
});
