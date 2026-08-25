import { createFileRoute } from "@tanstack/react-router";
import { MinhaSemanaView } from "@/components/dho/minha-semana-view";

export const Route = createFileRoute("/_authenticated/minha-semana")({
  component: MinhaSemanaView,
});
