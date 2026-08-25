import { createFileRoute } from "@tanstack/react-router";
import { NaoConformidadesView } from "@/components/operacional/nao-conformidades-view";

export const Route = createFileRoute("/_authenticated/nao-conformidades")({
  component: NaoConformidadesView,
});
