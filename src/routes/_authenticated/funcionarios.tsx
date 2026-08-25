import { createFileRoute } from "@tanstack/react-router";
import { FuncionariosView } from "@/components/dho/funcionarios-view";
export const Route = createFileRoute("/_authenticated/funcionarios")({ component: FuncionariosView });
