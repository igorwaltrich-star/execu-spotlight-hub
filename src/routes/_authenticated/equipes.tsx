import { createFileRoute } from "@tanstack/react-router";
import { EquipesView } from "@/components/dho/equipes-view";
export const Route = createFileRoute("/_authenticated/equipes")({ component: EquipesView });
