import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIAS = [
  { key: "metodo", label: "Método" },
  { key: "maquina", label: "Máquina" },
  { key: "mao_obra", label: "Mão-de-obra" },
  { key: "materiais", label: "Materiais" },
  { key: "medida", label: "Medida" },
  { key: "meio_ambiente", label: "Meio Ambiente" },
] as const;

type Row = {
  id: string; efeito: string;
  metodo: string[]; maquina: string[]; mao_obra: string[];
  materiais: string[]; medida: string[]; meio_ambiente: string[];
};

export function Ishikawa() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtimeTable("ishikawa", ["ishikawa"]);

  const { data: rows = [] } = useQuery({
    queryKey: ["ishikawa"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ishikawa").select("id, efeito, metodo, maquina, mao_obra, materiais, medida, meio_ambiente").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const [efeito, setEfeito] = useState("");
  const [textos, setTextos] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !efeito) throw new Error("Defina o efeito");
      const split = (k: string) => (textos[k] ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
      const { error } = await supabase.from("ishikawa").insert({
        user_id: user.id, efeito,
        metodo: split("metodo"), maquina: split("maquina"), mao_obra: split("mao_obra"),
        materiais: split("materiais"), medida: split("medida"), meio_ambiente: split("meio_ambiente"),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Diagrama salvo");
      qc.invalidateQueries({ queryKey: ["ishikawa"] });
      setEfeito(""); setTextos({});
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ishikawa").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ishikawa"] }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Diagrama de Ishikawa (Espinha de Peixe)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Efeito (problema central)</Label>
            <Input value={efeito} onChange={(e) => setEfeito(e.target.value)} placeholder="Ex: Queda de SLA no OTCC" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CATEGORIAS.map((c) => (
              <div key={c.key}>
                <Label>{c.label}</Label>
                <Textarea
                  rows={4}
                  placeholder="Uma causa por linha"
                  value={textos[c.key] ?? ""}
                  onChange={(e) => setTextos({ ...textos, [c.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar diagrama</Button>
        </CardContent>
      </Card>

      {rows.map((r) => (
        <Card key={r.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Efeito: {r.efeito}</CardTitle>
            <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              {CATEGORIAS.map((c) => {
                const items = r[c.key as keyof Row] as string[];
                return (
                  <div key={c.key}>
                    <div className="font-medium text-primary mb-1">{c.label}</div>
                    <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                      {items.length === 0 && <li className="list-none italic">—</li>}
                      {items.map((it, i) => <li key={i}>{it}</li>)}
                    </ul>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
