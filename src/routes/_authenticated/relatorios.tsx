import { createFileRoute } from "@tanstack/react-router";
import { RelatoriosView } from "@/components/dho/relatorios-view";
export const Route = createFileRoute("/_authenticated/relatorios")({ component: RelatoriosView });
