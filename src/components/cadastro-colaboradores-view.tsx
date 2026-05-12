import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { fmtMes, UNIDADES, UNIDADE_LABEL, MESES_PT, type UnidadeKey } from "@/lib/constants";
import { PageHeader } from "@/components/cadastro-operacional-view";

const norm = (s: string) =>
  s.toString().trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const UNIDADE_BY_LABEL: Record<string, UnidadeKey> = Object.fromEntries(
  UNIDADES.flatMap((u) => [
    [norm(u.label), u.key],
    [norm(u.key), u.key],
    [norm(u.label.replace(/\s+/g, "")), u.key],
  ])
) as Record<string, UnidadeKey>;

function parsePeriodo(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    const y = v.getUTCFullYear(); const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  }
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-01`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-01`;
  m = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}-01`;
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    const yy = Number(m[2]); const yyyy = yy < 100 ? 2000 + yy : yy;
    return `${yyyy}-${m[1].padStart(2, "0")}-01`;
  }
  m = s.match(/^([a-zç]{3,})[\/\-\s](\d{2,4})$/i);
  if (m) {
    const idx = MESES_PT.findIndex((mn) => norm(mn) === norm(m![1]).slice(0, 3));
    if (idx >= 0) {
      const yy = Number(m[2]); const yyyy = yy < 100 ? 2000 + yy : yy;
      return `${yyyy}-${String(idx + 1).padStart(2, "0")}-01`;
    }
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }
  return null;
}

type Row = {
  id: string;
  nome: string;
  unidade: UnidadeKey;
  mes: string;
  ausencias: number;
  fte: number | null;
};

export function CadastroColaboradoresView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["colaboradores"];
  useRealtimeTable("colaboradores", queryKey);

  const { data: rows = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("*")
        .order("mes", { ascending: false })
        .order("nome", { ascending: true });
      if (error) throw error;
      return data as Row[];
    },
  });

  const [nome, setNome] = useState("");
  const [unidade, setUnidade] = useState<UnidadeKey | "">("");
  const [mes, setMes] = useState("");
  const [ausencias, setAusencias] = useState<number | "">(0);

  const insert = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!nome || !unidade || !mes) throw new Error("Preencha nome, operação e período");
      const aus = Number(ausencias || 0);
      if (aus < 0 || aus > 30) throw new Error("Ausências devem estar entre 0 e 30");
      const { error } = await supabase.from("colaboradores").insert({
        user_id: user.id,
        nome,
        unidade,
        mes: `${mes}-01`,
        ausencias: aus,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Colaborador cadastrado");
      setNome(""); setUnidade(""); setMes(""); setAusencias(0);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("colaboradores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return (
    <>
      <PageHeader
        title="Cadastro de Colaboradores"
        description="Padrão Mês Comercial (30 dias). Proporção de Uso (FTE) = (30 − Ausências) / 30."
      />
      <div className="p-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Novo colaborador</CardTitle>
            <CardDescription>Informe ausências do mês (faltas, férias ou afastamento) em dias.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid grid-cols-1 md:grid-cols-5 gap-4"
              onSubmit={(e) => { e.preventDefault(); insert.mutate(); }}
            >
              <div className="space-y-2">
                <Label>Colaborador</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" required />
              </div>
              <div className="space-y-2">
                <Label>Operação</Label>
                <Select value={unidade} onValueChange={(v) => setUnidade(v as UnidadeKey)}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u.key} value={u.key}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Período</Label>
                <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Ausências (dias)</Label>
                <Input
                  type="number" min={0} max={30}
                  value={ausencias}
                  onChange={(e) => setAusencias(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full" disabled={insert.isPending}>Salvar</Button>
              </div>
            </form>
            <p className="text-xs text-muted-foreground mt-3">
              Disponibilidade considerada: 30 dias fixos por mês (mês comercial).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Colaboradores cadastrados</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Ausências</TableHead>
                  <TableHead className="text-right">FTE</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem colaboradores.</TableCell></TableRow>
                )}
                {rows.map((r) => {
                  const fte = Number(r.fte ?? 0);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.nome}</TableCell>
                      <TableCell>{UNIDADE_LABEL[r.unidade] ?? r.unidade}</TableCell>
                      <TableCell>{fmtMes(r.mes)}</TableCell>
                      <TableCell className="text-right">{r.ausencias}</TableCell>
                      <TableCell className="text-right font-medium">{fte.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => del.mutate(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
