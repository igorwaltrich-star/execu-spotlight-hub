import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Download, Upload, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import {
  fmtMes,
  META_PRODUTIVIDADE,
  metaProdUnidade,
  UNIDADES,
  UNIDADE_LABEL,
  type UnidadeKey,
} from "@/lib/constants";

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b border-border bg-card">
      <div className="px-8 py-6">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
    </div>
  );
}

type Row = { id: string; mes: string; volume: number; pessoas: number; unidade: UnidadeKey };

export function CadastroOperacionalView({ hideHeader = false }: { hideHeader?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["operacional_mensal"];
  useRealtimeTable("operacional_mensal", queryKey);

  const { data: rows = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operacional_mensal")
        .select("id, mes, volume, pessoas, unidade")
        .order("mes", { ascending: true });
      if (error) throw error;
      return data as Row[];
    },
  });

  const [unidade, setUnidade] = useState<UnidadeKey | "">("");
  const [mes, setMes] = useState("");
  const [volume, setVolume] = useState<number | "">("");
  const [pessoas, setPessoas] = useState<number | "">("");
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const upsert = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!unidade || !mes || volume === "" || pessoas === "")
        throw new Error("Preencha todos os campos");
      const { error } = await supabase.from("operacional_mensal").upsert(
        {
          user_id: user.id,
          unidade,
          mes: `${mes}-01`,
          volume: Number(volume),
          pessoas: Number(pessoas),
        },
        { onConflict: "user_id,mes,unidade" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro salvo");
      setMes("");
      setVolume("");
      setPessoas("");
      setUnidade("");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("operacional_mensal").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const fileRef = useRef<HTMLInputElement>(null);

  const baixarModelo = () => {
    const ws = XLSX.utils.json_to_sheet(
      UNIDADES.slice(0, 3).map((u) => ({
        unidade: u.label,
        mes: "2026-01",
        volume: 1000,
        pessoas: 12,
      })),
    );
    ws["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Operacional");
    XLSX.writeFile(wb, "modelo-operacional.xlsx");
  };

  const parseMes = (v: unknown): string | null => {
    if (v == null || v === "") return null;
    if (typeof v === "number") {
      const d = XLSX.SSF.parse_date_code(v);
      if (!d) return null;
      return `${d.y}-${String(d.m).padStart(2, "0")}-01`;
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-01`;
    m = s.match(/^(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[2]}-${m[1].padStart(2, "0")}-01`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-01`;
    return null;
  };

  const importar = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Não autenticado");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        wb.Sheets[wb.SheetNames[0]],
        { defval: "" },
      );
      const norm = (s: string) =>
        s.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const byKey = new Map<string, UnidadeKey>();
      UNIDADES.forEach((u) => {
        byKey.set(norm(u.key), u.key);
        byKey.set(norm(u.label), u.key);
      });

      const records = json
        .map((raw) => {
          const r: Record<string, unknown> = {};
          Object.entries(raw).forEach(([k, v]) => (r[norm(k)] = v));
          const unidade = byKey.get(norm(String(r.unidade ?? r.carteira ?? "")));
          const mes = parseMes(r.mes ?? r.mês ?? r.data);
          if (!unidade || !mes) return null;
          return {
            user_id: user.id,
            unidade,
            mes,
            volume: Number(r.volume) || 0,
            pessoas: Number(r.pessoas ?? r.headcount) || 0,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (records.length === 0)
        throw new Error("Nenhuma linha válida (colunas 'unidade' e 'mes' obrigatórias)");
      const { error } = await supabase
        .from("operacional_mensal")
        .upsert(records, { onConflict: "user_id,mes,unidade" });
      if (error) throw error;
      return records.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} registro(s) importado(s)`);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });



  return (
    <>
      {!hideHeader && (
        <PageHeader
          title="Cadastro Operacional"
          description={`Volume e número de pessoas por carteira/mês. Produtividade = volume / pessoas. Metas: Bosch 86 · Midea SC/RS 74 · Midea AM 69 · demais ${META_PRODUTIVIDADE}.`}
        />
      )}
      <div className="p-8 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle>Novo registro mensal</CardTitle>
              <CardDescription>
                Atualiza automaticamente se já existir registro para a mesma unidade/mês.
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={baixarModelo}>
                <Download className="h-4 w-4 mr-1" />
                Baixar modelo
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={importar.isPending}
              >
                <Upload className="h-4 w-4 mr-1" />
                {importar.isPending ? "Importando..." : "Importar"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importar.mutate(f);
                  e.target.value = "";
                }}
              />
            </div>
          </CardHeader>

          <CardContent>
            <form
              className="grid grid-cols-1 md:grid-cols-5 gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                upsert.mutate();
              }}
            >
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={unidade} onValueChange={(v) => setUnidade(v as UnidadeKey)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u.key} value={u.key}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mês</Label>
                <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Volume</Label>
                <Input
                  type="number"
                  min={0}
                  value={volume}
                  onChange={(e) => setVolume(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Pessoas</Label>
                <Input
                  type="number"
                  min={0}
                  value={pessoas}
                  onChange={(e) => setPessoas(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full" disabled={upsert.isPending}>
                  Salvar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Pessoas</TableHead>
                  <TableHead className="text-right">Produtividade</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Sem registros.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => {
                  const p = r.pessoas > 0 ? r.volume / r.pessoas : 0;
                  const ok = p >= metaProdUnidade(r.unidade);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {UNIDADE_LABEL[r.unidade] ?? r.unidade}
                      </TableCell>
                      <TableCell>{fmtMes(r.mes)}</TableCell>
                      <TableCell className="text-right">{r.volume}</TableCell>
                      <TableCell className="text-right">{r.pessoas}</TableCell>
                      <TableCell
                        className={`text-right font-medium ${r.pessoas > 0 ? (ok ? "text-success" : "text-destructive") : "text-muted-foreground"}`}
                      >
                        {r.pessoas > 0 ? p.toFixed(1) : "—"}
                      </TableCell>
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
