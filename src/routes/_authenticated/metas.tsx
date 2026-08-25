import { createFileRoute } from "@tanstack/react-router";
import { MetasView } from "@/components/dho/metas-view";

export const Route = createFileRoute("/_authenticated/metas")({
  component: MetasView,
});
