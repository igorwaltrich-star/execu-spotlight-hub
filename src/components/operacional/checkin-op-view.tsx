import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useColaboradores } from "@/components/gestao/use-colaboradores";
import { UNIDADES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";

type CheckIn = {
  id: string; operacao: string; data: string; frequencia: string;
  responsavel_id?: string; presentes: string[]; ausentes: string[];
  volume_previsto?: number; volume_realizado?: number;
  status_geral: "normal" | "atencao" | "critico";
  pendencias?: string; observacoes?: string;
};

const STATUS_CONFIG = {
  normal:  { label: "Normal",  cls: "bg-success/10 text-success border-0", icon: CheckCircle },
  atencao: { label: "Atenção", cls: "bg-warning/10 text-warning border-0",  icon: AlertTriangle },
  critico: { label: "Crítico", cls: "bg-destructive/10 text-destructive border-0", icon: XCircle },
};

const emptyForm = { operacao: "", data: new Date().toISOString().slice(0, 10), frequencia: "diario", presentes: "", ausentes: "", volume_previsto: "", volume_realizado: "", status_geral: "normal" as const, pendencias: "", observacoes: "" };

export function CheckInOpView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: colabs = [] } = useColaboradores();
  const [filtroOp, setFiltroOp] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: checkins = [] } = useQuery({
    queryKey: ["checkins_operacionais", filtroOp],
    queryFn: async () => {
      let q = supabase.from("checkins_operacionais").select("*").order("data", { ascending: false }).limit(100);
      if (filtroOp !== "all") q = q.eq("operacao", filtroOp);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CheckIn[];
    },
  });

  const hoje_checkins = checkins.filter(c => c.data === hoje);
  const semana_start = new Date(); semana_start.setDate(semana_start.getDate() - semana_start.getDay() + 1);
  const semana_dias = Array.from({ length: 5 }, (_, i) => { const d = new Date(semana_start); d.setDate(d.getDate() + i); return d.toISOString().slice(0, 10); });

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !form.operacao) throw new Error("Selecione uma operação");
      const { error } = await supabase.from("checkins_operacionais").insert({
        user_id: user.id, operacao: form.operacao, data: form.data, frequencia: form.frequencia,
        presentes: form.presentes.split(",").map(s => s.trim()).filter(Boolean),
        ausentes: form.ausentes.split(",").map(s => s.trim()).filter(Boolean),
        volume_previsto: form.volume_previsto ? Number(form.volume_previsto) : null,
        volume_realizado: form.volume_realizado ? Number(form.volume_realizado) : null,
        status_geral: form.status_geral, pendencias: form.pendencias || null, observacoes: form.observacoes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Check IN registrado"); qc.invalidateQueries({ queryKey: ["checkins_operacionais"] }); setOpen(false); setForm(emptyForm); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const getStatus = (op: string, dia: string) => {
    const c = checkins.find(x => x.operacao === op && x.data === dia);
    return c ? c.status_geral : null;
  };

  const statusDot = (s: string | null) => {
    if (!s) return <div className="w-full h-6 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">—</div>;
    const cfg = STATUS_CONFIG[s as keyof typeof STATUS_CONFIG];
    return <div className={`w-full h-6 rounded ${cfg.cls.replace("border-0","").trim()} flex items-center justify-center text-xs font-medium`}>{s === "normal" ? "✓" : s === "atencao" ? "!" : "✗"}</div>;
  };

  const ops = filtroOp === "all" ? UNIDADES : UNIDADES.filter(u => u.key === filtroOp);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Check IN Operacional</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Status diário/semanal por operação</p>
        </div>
        <Button size="sm" onClick={() => { setForm(emptyForm); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" /> Novo Check IN
        </Button>
      </div>

      <Select value={filtroOp} onValueChange={setFiltroOp}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Operação" /></SelectTrigger>
        <SelectContent><SelectItem value="all">Todas</SelectItem>{UNIDADES.map(u => <SelectItem key={u.key} value={u.key}>{u.label}</SelectItem>)}</SelectContent>
      </Select>

      {/* Hoje */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Check INs de hoje — {new Date().toLocaleDateString("pt-BR")}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ops.map(u => {
            const ci = hoje_checkins.find(c => c.operacao === u.key);
            const cfg = ci ? STATUS_CONFIG[ci.status_geral] : null;
            return (
              <Card key={u.key} className={ci ? "" : "border-dashed opacity-60"}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{u.label}</span>
                    {ci ? <Badge className={cfg!.cls}>{cfg!.label}</Badge> : <Badge variant="outline" className="text-xs">Pendente</Badge>}
                  </div>
                  {ci && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {ci.presentes.length > 0 && <div>Presentes: {ci.presentes.length}</div>}
                      {ci.ausentes.length > 0 && <div className="text-warning">Ausentes: {ci.ausentes.join(", ")}</div>}
                      {ci.volume_realizado != null && <div>Volume: {ci.volume_previsto ? `${ci.volume_realizado}/${ci.volume_previsto}` : ci.volume_realizado}</div>}
                      {ci.pendencias && <div className="text-warning">⚠ {ci.pendencias}</div>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Grade semanal */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Grade semanal</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium text-xs w-32">Operação</th>
                  {semana_dias.map(d => (
                    <th key={d} className="text-center py-2 px-2 text-muted-foreground font-medium text-xs">
                      {["Seg","Ter","Qua","Qui","Sex"][semana_dias.indexOf(d)]}
                      <br /><span className="font-normal">{d.slice(8)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ops.map(u => (
                  <tr key={u.key} className="border-t">
                    <td className="py-2 pr-4 font-medium text-xs">{u.label}</td>
                    {semana_dias.map(d => (
                      <td key={d} className="py-1 px-2 text-center">{statusDot(getStatus(u.key, d))}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span className="text-success font-medium">✓ Normal</span>
            <span className="text-warning font-medium">! Atenção</span>
            <span className="text-destructive font-medium">✗ Crítico</span>
            <span>— Pendente</span>
          </div>
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Histórico recente</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b">
              <th className="text-left py-2 px-4 text-muted-foreground font-medium text-xs">Data</th>
              <th className="text-left py-2 px-4 text-muted-foreground font-medium text-xs">Operação</th>
              <th className="text-left py-2 px-4 text-muted-foreground font-medium text-xs">Status</th>
              <th className="text-left py-2 px-4 text-muted-foreground font-medium text-xs">Volume</th>
              <th className="text-left py-2 px-4 text-muted-foreground font-medium text-xs">Obs.</th>
            </tr></thead>
            <tbody>
              {checkins.slice(0, 20).map(c => {
                const cfg = STATUS_CONFIG[c.status_geral];
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-4 text-xs">{new Date(c.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                    <td className="py-2 px-4 text-xs">{UNIDADES.find(u => u.key === c.operacao)?.label ?? c.operacao}</td>
                    <td className="py-2 px-4"><Badge className={cfg.cls}>{cfg.label}</Badge></td>
                    <td className="py-2 px-4 text-xs">{c.volume_realizado != null ? `${c.volume_realizado}${c.volume_previsto ? "/"+c.volume_previsto : ""}` : "—"}</td>
                    <td className="py-2 px-4 text-xs text-muted-foreground truncate max-w-[200px]">{c.pendencias || c.observacoes || "—"}</td>
                  </tr>
                );
              })}
              {checkins.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum check-in registrado</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Check IN Operacional</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Operação *</Label>
                <Select value={form.operacao} onValueChange={v => setForm(f => ({ ...f, operacao: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{UNIDADES.map(u => <SelectItem key={u.key} value={u.key}>{u.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div>
                <Label>Status geral</Label>
                <Select value={form.status_geral} onValueChange={v => setForm(f => ({ ...f, status_geral: v as typeof emptyForm["status_geral"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">✓ Normal</SelectItem>
                    <SelectItem value="atencao">! Atenção</SelectItem>
                    <SelectItem value="critico">✗ Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Frequência</Label>
                <Select value={form.frequencia} onValueChange={v => setForm(f => ({ ...f, frequencia: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="diario">Diário</SelectItem><SelectItem value="semanal">Semanal</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Volume previsto</Label>
                <Input type="number" value={form.volume_previsto} onChange={e => setForm(f => ({ ...f, volume_previsto: e.target.value }))} placeholder="Opcional" />
              </div>
              <div>
                <Label>Volume realizado</Label>
                <Input type="number" value={form.volume_realizado} onChange={e => setForm(f => ({ ...f, volume_realizado: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>
            <div>
              <Label>Ausentes (nomes separados por vírgula)</Label>
              <Input value={form.ausentes} onChange={e => setForm(f => ({ ...f, ausentes: e.target.value }))} placeholder="Ex: João, Maria" />
            </div>
            <div>
              <Label>Pendências / Intercorrências</Label>
              <Textarea value={form.pendencias} onChange={e => setForm(f => ({ ...f, pendencias: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label>Observações gerais</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
              {save.isPending ? "Salvando..." : "Registrar Check IN"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
