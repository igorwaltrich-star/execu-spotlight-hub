import { createFileRoute } from "@tanstack/react-router";
import { BancoHorasView } from "@/components/operacional/banco-horas-view";
export const Route = createFileRoute("/_authenticated/banco-horas")({ component: BancoHorasView });
