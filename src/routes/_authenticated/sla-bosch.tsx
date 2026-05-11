import { createFileRoute } from "@tanstack/react-router";
import { SlaView } from "@/components/sla-view";

export const Route = createFileRoute("/_authenticated/sla-bosch")({
  component: () => (
    <SlaView
      table="sla_bosch"
      title="SLA — BOSCH"
      description="Indicadores de SLA do cliente BOSCH."
      fields={[
        { key: "dig_conf", label: "Dig. Conf." },
        { key: "start_up", label: "Start-up" },
        { key: "otcc", label: "OTCC" },
        { key: "desvios", label: "Desvios" },
        { key: "pinho", label: "Pinho" },
      ]}
    />
  ),
});
