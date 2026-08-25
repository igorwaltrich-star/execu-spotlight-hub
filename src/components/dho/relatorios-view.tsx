import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useColaboradores } from "@/components/gestao/use-colaboradores";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, History, Users, Download } from "lucide-react";

type Atividade = { id: string; titulo: string; owner_id?: string; status: string; tipo: string; due_date?: string };
type Ocorrencia = { atividade_id: string; week_start: string; resultado?: string; pontuacao?: number; justificativa?: string };
type Meta = { id: string; titulo: string; owner_id?: string; valor_esperado: number; unidade: string };
type Resultado = { meta_id: string; periodo_inicio: string; valor_realizado: number; pct_atingimento: number };
type Audit = { id: string; user_id?: string; entity_type: string; entity_id?: string; action: string; old_value?: Record<string, unknown>; new_value?: Record<string, unknown>; created_at: string };

const ACAO_CFG: Record<string, { l: string; cls: string }> = {
  create: { l: "Criou",   cls: "bg-success/10 text-success border-0" },
  update: { l: "Alterou", cls: "bg-primary/10 text-primary border-0" },
  delete: { l: "Removeu", cls: "bg-destructive/10 text-destructive border-0" },
};
const ENTIDADE_LABEL: Record<string, string> = {
  atividades: "Atividade", metas: "Meta", resultados_meta: "Resultado de meta",
  projetos: "Projeto", planos_desenvolvimento: "PDI", atividades_desenvolvimento: "Atividade de PDI",
  nao_conformidades: "Não conformidade", registros_produtividade: "Produtividade",
  alocacoes_periodo: "Alocação", custo_pessoal_mensal: "Custo", checkins_operacionais: "Check IN Operacional",
  checkins_gerenciais: "Check IN Gerencial", checkin_gerencial_itens: "Item de reunião",
  revisoes_semanais: "Revisão semanal", equipes: "Equipe", membros_equipe: "Membro de equipe",
};
const RES_LABEL: Record<string, string> = {
  sucesso: "Sucesso", atraso: "Com atraso", desvios: "Com desvios",
  nao_realizado: "Não realizado", nao_aplicavel: "Não aplicável",
};

const fmtDT = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const fmtD = (d?: string) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

function csvDownload(nome: string, linhas: Record<string, string | number>[]) {
  if (linhas.length === 0) return;
  const cols = Object.keys(linhas[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(";"), ...linhas.map(l => cols.map(c => esc(l[c])).join(";"))].join("\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${nome}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export function RelatoriosView() {
  const { data: colabs = [] } = useColaboradores();
  const hoje = new Date().toISOString().slice(0, 10);
  const mesAtras = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [de, setDe] = useState(mesAtras);
  const [ate, setAte] = useState(hoje);
  const [colabSel, setColabSel] = useState("all");
  const [entidadeSel, setEntidadeSel] = useState("all");

  const fetchAll = <T,>(table: string) => async () => {
    const { data, error } = await supabase.from(table).select("*");
    if (error) throw error;
    return (data ?? []) as T[];
  };

  const { data: atividades = [] } = useQuery({ queryKey: ["rel_atividades"], queryFn: fetchAll<Atividade>("atividades") });
  const { data: ocorrencias = [] } = useQuery({ queryKey: ["rel_ocorrencias"], queryFn: fetchAll<Ocorrencia>("ocorrencias_atividade") });
  const { data: metas = [] } = useQuery({ queryKey: ["rel_metas"], queryFn: fetchAll<Meta>("metas") });
  const { data: resultados = [] } = useQuery({ queryKey: ["rel_resultados"], queryFn: fetchAll<Resultado>("resultados_meta") });
  const { data: audit = [] } = useQuery({
    queryKey: ["rel_audit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return (data ?? []) as Audit[];
    },
  });

  const nome = (id?: string) => id ? colabs.find(c => c.id === id)?.nome ?? "—" : "—";
  const noPeriodo = (d?: string) => !!d && d >= de && d <= ate;

  /* ── desempenho por colaborador ── */
  const desempenho = useMemo(() => {
    const ocsPeriodo = ocorrencias.filter(o => noPeriodo(o.week_start));
    const ativMap = new Map(atividades.map(a => [a.id, a]));
    const porPessoa = new Map<string, { total: number; pontos: number; res: Record<string, number> }>();
    ocsPeriodo.forEach(o => {
      const a = ativMap.get(o.atividade_id);
      if (!a?.owner_id) return;
      const cur = porPessoa.get(a.owner_id) ?? { total: 0, pontos: 0, res: {} };
      cur.total += 1;
      cur.pontos += Number(o.pontuacao ?? 0);
      if (o.resultado) cur.res[o.resultado] = (cur.res[o.resultado] ?? 0) + 1;
      porPessoa.set(a.owner_id, cur);
    });
    return Array.from(porPessoa.entries()).map(([uid, v]) => ({
      user_id: uid, nome: nome(uid), avaliacoes: v.total,
      media: v.total > 0 ? v.pontos / v.total : 0,
      sucesso: v.res.sucesso ?? 0, atraso: v.res.atraso ?? 0,
      desvios: v.res.desvios ?? 0, naoRealizado: v.res.nao_realizado ?? 0,
    })).sort((a, b) => b.media - a.media);
  }, [ocorrencias, atividades, colabs, de, ate]);

  /* ── atividades no período ── */
  const ativsPeriodo = useMemo(
    () => atividades.filter(a => colabSel === "all" || a.owner_id === colabSel),
    [atividades, colabSel],
  );

  /* ── metas no período ── */
  const metasRel = useMemo(() => {
    return metas
      .filter(m => colabSel === "all" || m.owner_id === colabSel)
      .map(m => {
        const rs = resultados.filter(r => r.meta_id === m.id && noPeriodo(r.periodo_inicio));
        const ultimo = rs.sort((a, b) => b.periodo_inicio.localeCompare(a.periodo_inicio))[0];
        return {
          ...m,
          registros: rs.length,
          realizado: ultimo?.valor_realizado ?? null,
          pct: ultimo ? Number(ultimo.pct_atingimento) : null,
        };
      });
  }, [metas, resultados, colabSel, de, ate]);

  /* ── justificativas ── */
  const justificativas = useMemo(() => {
    const ativMap = new Map(atividades.map(a => [a.id, a]));
    return ocorrencias
      .filter(o => noPeriodo(o.week_start) && o.justificativa?.trim())
      .map(o => {
        const a = ativMap.get(o.atividade_id);
        return { semana: o.week_start, atividade: a?.titulo ?? "—", responsavel: nome(a?.owner_id), resultado: o.resultado ?? "", justificativa: o.justificativa ?? "" };
      })
      .filter(j => colabSel === "all" || nome(colabSel) === j.responsavel)
      .sort((a, b) => b.semana.localeCompare(a.semana));
  }, [ocorrencias, atividades, colabSel, de, ate, colabs]);

  /* ── histórico ── */
  const historico = useMemo(() => audit.filter(a => {
    const dataOk = a.created_at.slice(0, 10) >= de && a.created_at.slice(0, 10) <= ate;
    const entOk = entidadeSel === "all" || a.entity_type === entidadeSel;
    return dataOk && entOk;
  }), [audit, de, ate, entidadeSel]);

  const camposAlterados = (a: Audit) => {
    if (a.action !== "update" || !a.old_value || !a.new_value) return [];
    const ignorar = new Set(["updated_at", "created_at"]);
    return Object.keys(a.new_value)
      .filter(k => !ignorar.has(k) && JSON.stringify(a.old_value?.[k]) !== JSON.stringify(a.new_value?.[k]))
      .slice(0, 4)
      .map(k => ({ campo: k, de: String(a.old_value?.[k] ?? "—"), para: String(a.new_value?.[k] ?? "—") }));
  };

  const scoreCls = (v: number) => v >= 85 ? "text-success" : v >= 70 ? "text-warning" : "text-destructive";

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Relatórios</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Consultas gerenciais e histórico de alterações</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 flex gap-3 flex-wrap items-end">
          <div><Label className="text-xs">De</Label><Input type="date" value={de} onChange={e => setDe(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={ate} onChange={e => setAte(e.target.value)} className="w-40" /></div>
          <div>
            <Label className="text-xs">Colaborador</Label>
            <Select value={colabSel} onValueChange={setColabSel}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {colabs.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="desempenho">
        <TabsList>
          <TabsTrigger value="desempenho">Desempenho</TabsTrigger>
          <TabsTrigger value="atividades">Atividades</TabsTrigger>
          <TabsTrigger value="metas">Metas</TabsTrigger>
          <TabsTrigger value="justificativas">Justificativas</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* DESEMPENHO */}
        <TabsContent value="desempenho" className="mt-4">
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm">Desempenho por colaborador</CardTitle>
                <CardDescription>Baseado nas revisões semanais do período</CardDescription>
              </div>
              <Button variant="outline" size="sm" disabled={desempenho.length === 0}
                onClick={() => csvDownload(`desempenho_${de}_a_${ate}`, desempenho.map(d => ({
                  Colaborador: d.nome, Avaliacoes: d.avaliacoes, Media: d.media.toFixed(1),
                  Sucesso: d.sucesso, Atraso: d.atraso, Desvios: d.desvios, NaoRealizado: d.naoRealizado,
                })))}>
                <Download className="h-3.5 w-3.5 mr-1.5" />CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {desempenho.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">Sem revisões registradas no período</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead className="text-right">Avaliações</TableHead>
                    <TableHead className="w-32">Pontuação</TableHead>
                    <TableHead className="text-right">Sucesso</TableHead>
                    <TableHead className="text-right">Atraso</TableHead>
                    <TableHead className="text-right">Desvios</TableHead>
                    <TableHead className="text-right">Não realiz.</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {desempenho.map(d => (
                      <TableRow key={d.user_id}>
                        <TableCell className="font-medium">{d.nome}</TableCell>
                        <TableCell className="text-right">{d.avaliacoes}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={Math.min(d.media, 100)} className="h-1.5 flex-1" />
                            <span className={`text-xs font-semibold w-9 text-right ${scoreCls(d.media)}`}>{d.media.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-success">{d.sucesso}</TableCell>
                        <TableCell className="text-right text-warning">{d.atraso}</TableCell>
                        <TableCell className="text-right text-warning">{d.desvios}</TableCell>
                        <TableCell className="text-right text-destructive">{d.naoRealizado}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ATIVIDADES */}
        <TabsContent value="atividades" className="mt-4">
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Atividades ({ativsPeriodo.length})</CardTitle>
              <Button variant="outline" size="sm" disabled={ativsPeriodo.length === 0}
                onClick={() => csvDownload("atividades", ativsPeriodo.map(a => ({
                  Titulo: a.titulo, Responsavel: nome(a.owner_id), Tipo: a.tipo, Status: a.status, Prazo: fmtD(a.due_date),
                })))}>
                <Download className="h-3.5 w-3.5 mr-1.5" />CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Atividade</TableHead><TableHead>Responsável</TableHead>
                  <TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Prazo</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {ativsPeriodo.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Nenhuma atividade</TableCell></TableRow>}
                  {ativsPeriodo.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.titulo}</TableCell>
                      <TableCell>{nome(a.owner_id)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{a.tipo}</Badge></TableCell>
                      <TableCell><Badge variant={a.status === "concluida" ? "secondary" : a.status === "atrasada" ? "destructive" : "outline"} className="text-[10px]">{a.status}</Badge></TableCell>
                      <TableCell>{fmtD(a.due_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* METAS */}
        <TabsContent value="metas" className="mt-4">
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm">Metas e atingimento</CardTitle>
              <Button variant="outline" size="sm" disabled={metasRel.length === 0}
                onClick={() => csvDownload(`metas_${de}_a_${ate}`, metasRel.map(m => ({
                  Meta: m.titulo, Responsavel: nome(m.owner_id), Esperado: m.valor_esperado,
                  Unidade: m.unidade, Realizado: m.realizado ?? "—", Atingimento: m.pct != null ? `${m.pct.toFixed(1)}%` : "—",
                })))}>
                <Download className="h-3.5 w-3.5 mr-1.5" />CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Meta</TableHead><TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Esperado</TableHead><TableHead className="text-right">Realizado</TableHead>
                  <TableHead className="text-right">Atingimento</TableHead><TableHead className="text-right">Registros</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {metasRel.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhuma meta</TableCell></TableRow>}
                  {metasRel.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.titulo}</TableCell>
                      <TableCell>{nome(m.owner_id)}</TableCell>
                      <TableCell className="text-right">{m.valor_esperado} {m.unidade}</TableCell>
                      <TableCell className="text-right">{m.realizado ?? "—"}</TableCell>
                      <TableCell className={`text-right font-semibold ${m.pct == null ? "text-muted-foreground" : scoreCls(m.pct)}`}>
                        {m.pct != null ? `${m.pct.toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{m.registros}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* JUSTIFICATIVAS */}
        <TabsContent value="justificativas" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Justificativas de desvio ({justificativas.length})</CardTitle>
              <CardDescription>Atrasos, desvios e não realizados com justificativa registrada</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {justificativas.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">Nenhuma justificativa no período</p>}
              {justificativas.map((j, i) => (
                <div key={i} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium">{j.atividade}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{RES_LABEL[j.resultado] ?? j.resultado}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1.5">{j.responsavel} · semana de {fmtD(j.semana)}</div>
                  <p className="text-sm border-l-2 border-muted pl-2.5">{j.justificativa}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="historico" className="mt-4 space-y-3">
          <Select value={entidadeSel} onValueChange={setEntidadeSel}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Tipo de registro" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os registros</SelectItem>
              {Object.entries(ENTIDADE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" />Histórico de alterações ({historico.length})</CardTitle>
              <CardDescription>Quem alterou, quando e o que mudou</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {historico.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-10">
                  Nenhuma alteração registrada no período. O histórico começa a ser gravado a partir da aplicação desta versão.
                </p>
              )}
              {historico.map(a => {
                const cfg = ACAO_CFG[a.action] ?? ACAO_CFG.update;
                const mudancas = camposAlterados(a);
                const titulo = String(a.new_value?.titulo ?? a.new_value?.nome ?? a.new_value?.competencia
                  ?? a.old_value?.titulo ?? a.old_value?.nome ?? a.old_value?.competencia ?? "");
                return (
                  <div key={a.id} className="p-3 rounded-lg border text-sm">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge className={`${cfg.cls} text-[10px]`}>{cfg.l}</Badge>
                        <span className="text-muted-foreground text-xs">{ENTIDADE_LABEL[a.entity_type] ?? a.entity_type}</span>
                        {titulo && <span className="font-medium">{titulo}</span>}
                      </div>
                      <span className="text-xs text-muted-foreground">{fmtDT(a.created_at)}</span>
                    </div>
                    {mudancas.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {mudancas.map(m => (
                          <div key={m.campo} className="text-xs text-muted-foreground">
                            <span className="font-medium">{m.campo}:</span>{" "}
                            <span className="line-through opacity-60">{m.de.slice(0, 40)}</span>{" → "}
                            <span className="text-foreground">{m.para.slice(0, 40)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
