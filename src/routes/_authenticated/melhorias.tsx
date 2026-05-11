import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Lightbulb, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cadastro-operacional-view";

type Row = { id: string; titulo: string; descricao: string; tipo: "atencao" | "oportunidade" };

export const Route = createFileRoute("/_authenticated/melhorias")({
  component: MelhoriasPage,
});

function MelhoriasPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["melhorias"];
  useRealtimeTable("melhorias", queryKey);

  const { data: rows = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.from("melhorias").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<"atencao" | "oportunidade">("oportunidade");

  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("melhorias").insert({ user_id: user.id, titulo, descricao, tipo });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item adicionado");
      setTitulo(""); setDescricao(""); setTipo("oportunidade");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("melhorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return (
    <>
      <PageHeader title="Melhorias e Oportunidades" description="Itens de atenção e oportunidades identificadas." />
      <div className="p-8 space-y-6">
        <Card>
          <CardHeader><CardTitle>Novo item</CardTitle></CardHeader>
          <CardContent>
            <form className="grid grid-cols-1 md:grid-cols-12 gap-4" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
              <div className="space-y-2 md:col-span-5">
                <Label>Título</Label>
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
              </div>
              <div className="space-y-2 md:col-span-5">
                <Label>Descrição</Label>
                <Textarea rows={1} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atencao">Atenção</SelectItem>
                    <SelectItem value="oportunidade">Oportunidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end md:col-span-1">
                <Button type="submit" className="w-full" disabled={add.isPending}>+</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(["atencao", "oportunidade"] as const).map((t) => {
            const items = rows.filter((r) => r.tipo === t);
            const isAtencao = t === "atencao";
            const Icon = isAtencao ? AlertCircle : Lightbulb;
            return (
              <Card key={t}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${isAtencao ? "text-warning" : "text-success"}`} />
                    {isAtencao ? "Pontos de Atenção" : "Oportunidades"}
                  </CardTitle>
                  <Badge variant="secondary">{items.length}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item.</p>}
                  {items.map((r) => (
                    <div key={r.id} className="border rounded-md p-3 flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{r.titulo}</div>
                        {r.descricao && <div className="text-xs text-muted-foreground mt-1">{r.descricao}</div>}
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
