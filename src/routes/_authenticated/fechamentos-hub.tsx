import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Restrito } from "@/components/acesso-restrito";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePerfil } from "@/hooks/use-perfil";
import { FechamentosTab } from "@/components/fechamentos-hub/fechamentos-tab";
import { HubTab } from "@/components/fechamentos-hub/hub-tab";

const PAPEIS = ["gestor", "coordenador", "supervisor"] as const;

export const Route = createFileRoute("/_authenticated/fechamentos-hub")({
  head: () => ({
    meta: [
      { title: "Fechamentos e Hub | Execu Spotlight" },
      {
        name: "description",
        content:
          "Fechamentos pendentes no Sigra com comparação entre bases, adesão ao Hub e pendências de onboarding.",
      },
    ],
  }),
  component: () => (
    <Restrito papeis={[...PAPEIS]}>
      <FechamentosHub />
    </Restrito>
  ),
});

function FechamentosHub() {
  const { eUmDe } = usePerfil();
  const podeEditar = eUmDe([...PAPEIS]);
  // aba lembrada pelo link: …/fechamentos-hub#hub
  const [aba, setAba] = useState("fechamentos");
  useEffect(() => {
    if (window.location.hash === "#hub") setAba("hub");
  }, []);
  const mudar = (v: string) => {
    setAba(v);
    history.replaceState(null, "", v === "hub" ? "#hub" : window.location.pathname);
  };
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Fechamentos e Hub</h1>
        <p className="text-sm text-muted-foreground">
          Processos com DI/DUIMP sem pedido de fechamento no Sigra e adesão das equipes ao Hub.
        </p>
      </div>
      <Tabs value={aba} onValueChange={mudar}>
        <TabsList>
          <TabsTrigger value="fechamentos">Fechamentos Sigra</TabsTrigger>
          <TabsTrigger value="hub">Pendências Hub</TabsTrigger>
        </TabsList>
        <TabsContent value="fechamentos" className="mt-4">
          <FechamentosTab podeEditar={podeEditar} />
        </TabsContent>
        <TabsContent value="hub" className="mt-4">
          <HubTab podeEditar={podeEditar} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
