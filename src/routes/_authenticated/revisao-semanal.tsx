import { createFileRoute } from "@tanstack/react-router";
import { RevisaoSemanalView } from "@/components/dho/revisao-semanal-view";
export const Route = createFileRoute("/_authenticated/revisao-semanal")({ component: RevisaoSemanalView });
