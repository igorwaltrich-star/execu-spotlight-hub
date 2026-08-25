import { createFileRoute } from "@tanstack/react-router";
import { CheckInOpView } from "@/components/operacional/checkin-op-view";

export const Route = createFileRoute("/_authenticated/checkin-operacional")({
  component: CheckInOpView,
});
