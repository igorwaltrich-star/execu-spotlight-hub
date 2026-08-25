import { createFileRoute } from "@tanstack/react-router";
import { DashboardDhoView } from "@/components/dho/dashboard-dho-view";

export const Route = createFileRoute("/_authenticated/dashboard-gestao")({
  component: DashboardDhoView,
});
