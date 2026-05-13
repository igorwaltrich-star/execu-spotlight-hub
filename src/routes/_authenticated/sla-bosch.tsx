import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";
import { PageHeader } from "@/components/cadastro-operacional-view";

export const Route = createFileRoute("/_authenticated/sla-bosch")({
  component: () => (
    <>
      <PageHeader title="SLA — BOSCH" description="Indicadores de SLA do cliente BOSCH." />
      <div className="p-8">
        <div className="flex flex-col items-center justify-center text-center border border-dashed rounded-lg p-16 bg-muted/30">
          <Construction className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Em construção</h2>
          <p className="text-muted-foreground mt-2 max-w-md">
            Esta seção está sendo preparada e estará disponível em breve.
          </p>
        </div>
      </div>
    </>
  ),
});
