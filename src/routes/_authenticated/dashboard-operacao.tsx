import { createFileRoute } from "@tanstack/react-router";
import { DashboardOperacaoView } from "@/components/operacional/dashboard-operacao-view";

export const Route = createFileRoute("/_authenticated/dashboard-operacao")({
  component: DashboardOperacaoView,
});
