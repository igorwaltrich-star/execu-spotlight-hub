import { createFileRoute } from "@tanstack/react-router";
import { SlaView } from "@/components/sla-view";

export const Route = createFileRoute("/_authenticated/sla-midea")({
  component: () => (
    <SlaView
      table="sla_midea"
      title="SLA — Midea"
      description="Indicadores de SLA do cliente Midea."
      fields={[
        { key: "start_up", label: "Start-up" },
        { key: "otcc", label: "OTCC" },
        { key: "otd", label: "OTD" },
        { key: "sotd", label: "SOTD" },
      ]}
    />
  ),
});
