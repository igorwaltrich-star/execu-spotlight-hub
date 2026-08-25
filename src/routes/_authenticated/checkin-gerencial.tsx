import { createFileRoute } from "@tanstack/react-router";
import { CheckinGerencialView } from "@/components/dho/checkin-gerencial-view";
export const Route = createFileRoute("/_authenticated/checkin-gerencial")({ component: CheckinGerencialView });
