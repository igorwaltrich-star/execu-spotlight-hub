import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useColaboradores } from "@/components/gestao/use-colaboradores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, Download, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

type BancoHoras = { id: string; colaborador_id: string; mes: string; horas_extras: number; horas_debito: number; saldo_acumulado: number; observacoes?: string; };

const fmtH = (h: number) => { const sign = h >= 0 ? "+" : ""; return `${sign}${h.toFixed(1)}h`; };
const fmtDate = (d: string) => { const [y, m] = d.split("-"); return `${["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][Number(m)-1]}/${y.slice(2)}`; };

export function BancoHorasView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: colabs = [] } = useColaboradores();
  const fileRef = useRef<HTMLInputElement>(null);
  const [filtroCol, setFiltroCol] = useState("all");
  const [filtroMes, setFiltroMes] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ colaborador_id: "", mes: new Date().toISOString().slice(0, 7), horas_extras: "0", horas_debito: "0", saldo_acumulado: "0", observacoes: "" });

  const { data: registros = [] } = useQuery({
    queryKey: ["banco_horas", filtroCol, filtroMes],
    queryFn: async () => {
      let q = supabase.from("banco_horas").select("*").order("mes", { ascending: false }).order("colaborador_id");
      if (filtroCol !== "all") q = q.eq("colaborador_id", filtroCol);
      if (filtroMes) q = q.eq("mes", filtroMes + "-01");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as BancoHoras[];
    },
  });

  const nome = (id: string) => colabs.find(c => c.id === id)?.nome ?? "—";

  const kpis = {
    saldoTotal: registros.reduce((s, r) => s + Number(r.saldo_acumulado), 0),
    extrasTotal: registros.reduce((s, r) => s + Number(r.horas_extras), 0),
    debitoTotal: registros.reduce((s, r) => s + Number(r.horas_debito), 0),
    count: new Set(registros.map(r => r.colaborador_id)).size,
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !form.colaborador_id) throw new Error("Selecione um colaborador");
      const { error } = await supabase.from("banco_horas").upsert({
        user_id: user.id, colaborador_id: form.colaborador_id, mes: form.mes + "-01",
        horas_extras: Number(form.horas_extras), horas_debito: Number(form.horas_debito),
        saldo_acumulado: Number(form.saldo_acumulado), observacoes: form.observacoes || null,
      }, { onConflict: "colaborador_id,mes" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Banco de horas salvo"); qc.invalidateQueries({ queryKey: ["banco_horas"] }); setOpen(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const importar = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Não autenticado");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const norm = (k: string) => k.toString().trim().toLowerCase().replace(/\s+/g, "_");
      const byNome = new Map(colabs.map(c => [c.nome.trim().toLowerCase(), c.id]));
      const records = json.map(r => {
        const e: Record<string, string> = {};
        Object.entries(r).forEach(([k, v]) => { e[norm(k)] = String(v ?? "").trim(); });
        const colabId = byNome.get((e.colaborador || e.nome || "").toLowerCase());
        if (!colabId) return null;
        const mes = e.mes || e.mês || "";
        const mesFormatted = mes.match(/^\d{4}-\d{2}$/) ? mes + "-01" : null;
        if (!mesFormatted) return null;
        return { user_id: user.id, colaborador_id: colabId, mes: mesFormatted, horas_extras: Number(e.horas_extras || e.extras || 0), horas_debito: Number(e.horas_debito || e.debito || 0), saldo_acumulado: Number(e.saldo_acumulado || e.saldo || 0) };
      }).filter(Boolean);
      if (records.length === 0) throw new Error("Nenhuma linha válida. Colunas esperadas: colaborador, mes (AAAA-MM), horas_extras, horas_debito, saldo_acumulado");
      const { error } = await supabase.from("banco_horas").upsert(records as never[], { onConflict: "colaborador_id,mes" });
      if (error) throw error;
      return records.length;
    },
    onSuccess: n => { toast.success(`${n} registros importados`); qc.invalidateQueries({ queryKey: ["banco_horas"] }); },
    onError: e => toast.error(e instanceof Error ? e.message : "Erro na importação"),
  });

  const baixarModelo = () => {
    const ws = XLSX.utils.json_to_sheet([
      { colaborador: "João Silva", mes: "2026-08", horas_extras: 8, horas_debito: 0, saldo_acumulado: 8 },
      { colaborador: "Maria Souza", mes: "2026-08", horas_extras: 0, horas_debito: 4, saldo_acumulado: -4 },
    ]);
    ws["!cols"] = [{ wch: 28 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BancoHoras");
    XLSX.writeFile(wb, "modelo-banco-horas.xlsx");
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Banco de Horas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Saldo de horas extras e débitos por colaborador</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={baixarModelo}><Download className="h-4 w-4 mr-1.5" />Modelo</Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importar.isPending}>
            <Upload className="h-4 w-4 mr-1.5" />{importar.isPending ? "Importando..." : "Importar Excel"}
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importar.mutate(f); e.target.value = ""; }} />
          <Button size="sm" onClick={() => { setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />Novo Registro
          </Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={filtroCol} onValueChange={setFiltroCol}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Colaborador" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem>{colabs.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="month" value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className="w-40" placeholder="Mês" />
        {filtroMes && <Button variant="ghost" size="sm" onClick={() => setFiltroMes("")}>Limpar</Button>}
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { l: "Colaboradores", v: kpis.count, icon: Clock, cls: "" },
          { l: "Horas extras total", v: fmtH(kpis.extrasTotal), icon: TrendingUp, cls: "text-success" },
          { l: "Débito total", v: fmtH(-kpis.debitoTotal), icon: TrendingDown, cls: "text-destructive" },
          { l: "Saldo consolidado", v: fmtH(kpis.saldoTotal), icon: Clock, cls: kpis.saldoTotal >= 0 ? "text-success" : "text-destructive" },
        ].map(({ l, v, icon: Icon, cls }) => (
          <Card key={l}><CardContent className="pt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">{l}</span>
              <Icon className={`h-4 w-4 ${cls || "text-muted-foreground"}`} />
            </div>
            <div className={`text-xl font-semibold ${cls}`}>{v}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Horas extras</TableHead>
                <TableHead className="text-right">Débito</TableHead>
                <TableHead className="text-right">Saldo acumulado</TableHead>
                <TableHead>Obs.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registros.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Nenhum registro. Importe uma planilha ou adicione manualmente.</TableCell></TableRow>}
              {registros.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{nome(r.colaborador_id)}</TableCell>
                  <TableCell>{fmtDate(r.mes)}</TableCell>
                  <TableCell className="text-right"><Badge className="bg-success/10 text-success border-0">{fmtH(Number(r.horas_extras))}</Badge></TableCell>
                  <TableCell className="text-right">{Number(r.horas_debito) > 0 ? <Badge className="bg-destructive/10 text-destructive border-0">{fmtH(-Number(r.horas_debito))}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right font-semibold">
                    <span className={Number(r.saldo_acumulado) >= 0 ? "text-success" : "text-destructive"}>{fmtH(Number(r.saldo_acumulado))}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.observacoes ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo registro — banco de horas</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Colaborador *</Label>
              <Select value={form.colaborador_id} onValueChange={v => setForm(f => ({ ...f, colaborador_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{colabs.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Mês de referência</Label><Input type="month" value={form.mes} onChange={e => setForm(f => ({ ...f, mes: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Horas extras</Label><Input type="number" step="0.5" value={form.horas_extras} onChange={e => setForm(f => ({ ...f, horas_extras: e.target.value }))} /></div>
              <div><Label>Débito (h)</Label><Input type="number" step="0.5" value={form.horas_debito} onChange={e => setForm(f => ({ ...f, horas_debito: e.target.value }))} /></div>
              <div><Label>Saldo acumulado</Label><Input type="number" step="0.5" value={form.saldo_acumulado} onChange={e => setForm(f => ({ ...f, saldo_acumulado: e.target.value }))} /></div>
            </div>
            <div><Label>Observações</Label><Input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Opcional" /></div>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">{save.isPending ? "Salvando..." : "Salvar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
