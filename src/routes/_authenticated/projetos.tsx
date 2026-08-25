import { createFileRoute } from "@tanstack/react-router";
import { ProjetosView } from "@/components/dho/projetos-view";
export const Route = createFileRoute("/_authenticated/projetos")({ component: ProjetosView });
