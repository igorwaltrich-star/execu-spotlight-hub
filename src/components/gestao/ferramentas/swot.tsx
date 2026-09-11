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
import { TrendingUp, TrendingDown, Sparkles, AlertTriangle, Trash2, Pencil, X, Brain, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { gerarSwotIA } from "@/lib/swot-ia.functions";

type Row = {
  id: string;
  titulo: string;
  forcas: string[];
  fraquezas: string[];
  oportunidades: string[];
  ameacas: string[];
  insight: string | null;
};

const QUADRANTES = [
  { key: "forcas", label: "Forças", icon: TrendingUp, color: "text-success", bg: "bg-success/10 border-success/30" },
  { key: "fraquezas", label: "Fraquezas", icon: TrendingDown, color: "text-destructive", bg: "bg-destructive/10 border-destructive/30" },
  { key: "oportunidades", label: "Oportunidades", icon: Sparkles, color: "text-primary", bg: "bg-primary/10 border-primary/30" },
  { key: "ameacas", label: "Ameaças", icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10 border-warning/30" },
] as const;

export function Swot() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useRealtimeTable("swot", ["swot"]);

  const { data: rows = [] } = useQuery({
    queryKey: ["swot"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("swot")
        .select("id, titulo, forcas, fraquezas, oportunidades, ameacas, insight")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  // Form state (used for both create and edit)
  const [titulo, setTitulo] = useState("");
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [insight, setInsight] = useState("");

  const resetForm = () => { setTitulo(""); setTextos({}); setEditId(null); setInsight(""); };

  const startEdit = (r: Row) => {
    setTitulo(r.titulo);
    setTextos({
      forcas: r.forcas.join("\n"),
      fraquezas: r.fraquezas.join("\n"),
      oportunidades: r.oportunidades.join("\n"),
      ameacas: r.ameacas.join("\n"),
    });
    setInsight(r.insight ?? "");
    setEditId(r.id);
    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const split = (k: string) =>
    (textos[k] ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !titulo) throw new Error("Defina um título");
      const { error } = await supabase.from("swot").insert({
        user_id: user.id,
        titulo,
        forcas: split("forcas"),
        fraquezas: split("fraquezas"),
        oportunidades: split("oportunidades"),
        ameacas: split("ameacas"),
        insight: insight.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("SWOT salvo");
      qc.invalidateQueries({ queryKey: ["swot"] });
      resetForm();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editId || !titulo) throw new Error("Defina um título");
      const { error } = await supabase.from("swot").update({
        titulo,
        forcas: split("forcas"),
        fraquezas: split("fraquezas"),
        oportunidades: split("oportunidades"),
        ameacas: split("ameacas"),
        insight: insight.trim() || null,
      }).eq("id", editId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("SWOT atualizado");
      qc.invalidateQueries({ queryKey: ["swot"] });
      resetForm();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("swot").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["swot"] }),
  });

  const gerarIA = useMutation({
    mutationFn: async () => await gerarSwotIA({ data: undefined }),
    onSuccess: (r) => {
      setTextos({
        forcas: r.forcas.join("\n"),
        fraquezas: r.fraquezas.join("\n"),
        oportunidades: r.oportunidades.join("\n"),
        ameacas: r.ameacas.join("\n"),
      });
      setInsight(r.insight);
      if (!titulo) {
        const hoje = new Date();
        setTitulo(`SWOT automática — ${hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`);
      }
      toast.success("Insight gerado. Revise e salve.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível gerar o insight"),
  });

  return (
    <div className="space-y-4">
      <Card className={editId ? "border-primary/50 ring-1 ring-primary/30" : ""}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{editId ? "Editar Análise SWOT" : "Nova Análise SWOT"}</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => gerarIA.mutate()} disabled={gerarIA.isPending}>
              {gerarIA.isPending
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <Brain className="h-4 w-4 mr-1" />}
              {gerarIA.isPending ? "Analisando dados..." : "Gerar insight com IA"}
            </Button>
            {editId && (
              <Button size="sm" variant="outline" onClick={resetForm}>
                <X className="h-4 w-4 mr-1" />Cancelar edição
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: SWOT operação Q2/2026" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {QUADRANTES.map((q) => {
              const Icon = q.icon;
              return (
                <div key={q.key} className={`p-3 rounded-lg border ${q.bg}`}>
                  <Label className={`flex items-center gap-1 mb-2 ${q.color}`}>
                    <Icon className="h-4 w-4" />{q.label}
                  </Label>
                  <Textarea rows={4} placeholder="Um item por linha"
                    value={textos[q.key] ?? ""}
                    onChange={(e) => setTextos({ ...textos, [q.key]: e.target.value })} />
                </div>
              );
            })}
          </div>
          <div>
            <Label>Diagnóstico (insight automático)</Label>
            <Textarea rows={5} value={insight} onChange={(e) => setInsight(e.target.value)}
              placeholder="Gerado automaticamente pela IA a partir dos dados operacionais e financeiros — pode ser editado." />
          </div>
          <Button onClick={() => editId ? update.mutate() : save.mutate()}
            disabled={save.isPending || update.isPending}>
            {editId ? "Salvar alterações" : "Salvar análise"}
          </Button>
        </CardContent>
      </Card>

      {rows.map((r) => (
        <Card key={r.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{r.titulo}</CardTitle>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => startEdit(r)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {r.insight && (
              <div className="p-3 rounded-lg border bg-muted/40">
                <div className="flex items-center gap-1 font-medium mb-1 text-primary">
                  <Brain className="h-4 w-4" />Diagnóstico
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{r.insight}</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {QUADRANTES.map((q) => {
                const Icon = q.icon;
                const items = r[q.key as keyof Row] as string[];
                return (
                  <div key={q.key} className={`p-3 rounded-lg border ${q.bg}`}>
                    <div className={`flex items-center gap-1 font-medium mb-2 ${q.color}`}>
                      <Icon className="h-4 w-4" />{q.label}
                    </div>
                    <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-0.5">
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
