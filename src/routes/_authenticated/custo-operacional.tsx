import { createFileRoute } from "@tanstack/react-router";
import { CustoOperacionalView } from "@/components/operacional/custo-operacional-view";
export const Route = createFileRoute("/_authenticated/custo-operacional")({ component: CustoOperacionalView });
