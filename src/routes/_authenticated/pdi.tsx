import { createFileRoute } from "@tanstack/react-router";
import { PdiView } from "@/components/dho/pdi-view";
export const Route = createFileRoute("/_authenticated/pdi")({ component: PdiView });
