import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cadastro-operacional-view";

type Row = { id: string; item: string; impacto: string; risco: "alto" | "medio" | "baixo" };

export const Route = createFileRoute("/_authenticated/diagnostico")({
  component: DiagnosticoPage,
});

function riscoColor(r: string) {
  if (r === "alto") return "bg-destructive text-destructive-foreground";
  if (r === "medio") return "bg-warning text-warning-foreground";
  return "bg-success text-success-foreground";
}

function DiagnosticoPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["gargalos"];
  useRealtimeTable("gargalos", queryKey);

  const { data: rows = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.from("gargalos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });

  const [item, setItem] = useState("");
  const [impacto, setImpacto] = useState("");
  const [risco, setRisco] = useState<"alto" | "medio" | "baixo">("medio");

  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("gargalos").insert({ user_id: user.id, item, impacto, risco });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item adicionado");
      setItem(""); setImpacto(""); setRisco("medio");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gargalos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return (
    <>
      <PageHeader title="Diagnóstico — Gargalos e Riscos" description="Mapeamento de pontos de atenção e seus impactos." />
      <div className="p-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Novo gargalo / risco</CardTitle>
            <CardDescription>Descreva o item e classifique o nível de risco.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid grid-cols-1 md:grid-cols-12 gap-4" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
              <div className="space-y-2 md:col-span-4">
                <Label>Item</Label>
                <Input value={item} onChange={(e) => setItem(e.target.value)} required />
              </div>
              <div className="space-y-2 md:col-span-5">
                <Label>Impacto</Label>
                <Input value={impacto} onChange={(e) => setImpacto(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Risco</Label>
                <Select value={risco} onValueChange={(v) => setRisco(v as typeof risco)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alto">Alto</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="baixo">Baixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end md:col-span-1">
                <Button type="submit" className="w-full" disabled={add.isPending}>+</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["alto", "medio", "baixo"] as const).map((nivel) => {
            const items = rows.filter((r) => r.risco === nivel);
            return (
              <Card key={nivel}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="capitalize">{nivel === "medio" ? "Médio" : nivel}</CardTitle>
                  <Badge className={riscoColor(nivel)}>{items.length}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item.</p>}
                  {items.map((r) => (
                    <div key={r.id} className="border rounded-md p-3 flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{r.item}</div>
                        {r.impacto && <div className="text-xs text-muted-foreground mt-1">{r.impacto}</div>}
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}

export const _T = Textarea;
