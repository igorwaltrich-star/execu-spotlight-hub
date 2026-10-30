import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRightLeft, Filter, FileSpreadsheet, Search, Upload } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  FAIXAS,
  chavePendencia,
  compararCentros,
  contarFaixas,
  faixaDe,
  situacaoCentro,
  type LinhaPendencia,
  type LinhaResumo,
  type Situacao,
} from "@/lib/fechamento-pendente";
import {
  carregarPendencias,
  carregarResumos,
  importarFechamento,
  listarImportacoesFechamento,
  resumoEstimado,
  type Importacao,
} from "./dados";
import { BotaoCopiar, Delta, Empilhada, Kpi } from "./ui";
import { COR_FAIXA, dataBr, n0, pct } from "./formato";

const CHAVE_CENTROS = "fechamentos-hub:centros";
const SITUACAO: Record<Situacao, { rotulo: string; cls: string }> = {
  critico: { rotulo: "Crítico", cls: "bg-destructive/10 text-destructive" },
  atencao: { rotulo: "Atenção", cls: "bg-warning/15 text-warning" },
  ok: { rotulo: "Em dia", cls: "bg-success/10 text-success" },
  sem_fluxo: { rotulo: "Sem fluxo", cls: "bg-muted text-muted-foreground" },
};
const FAIXA_KEYS = FAIXAS.map((f) => f.key);
const valoresFaixa = (r: Pick<LinhaResumo, (typeof FAIXA_KEYS)[number]> | null) =>
  FAIXA_KEYS.map((k) => (r ? r[k] : 0));
const rotuloImp = (i: Importacao) =>
  `${dataBr(i.data_referencia ?? i.created_at, true)}${resumoEstimado(i) ? " · CSV" : ""}`;

export function FechamentosTab({ podeEditar }: { podeEditar: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);

  const imps = useQuery({ queryKey: ["fh_importacoes"], queryFn: listarImportacoesFechamento });
  const [atualId, setAtualId] = useState<string | null>(null);
  const [anteriorId, setAnteriorId] = useState<string | null>(null);
  const lista = imps.data ?? [];
  const atual = lista.find((i) => i.id === atualId) ?? lista[0] ?? null;
  const idxAtual = atual ? lista.indexOf(atual) : -1;
  const anterior =
    anteriorId === "nenhuma"
      ? null
      : (lista.find((i) => i.id === anteriorId && lista.indexOf(i) > idxAtual) ??
        lista[idxAtual + 1] ??
        null);

  const dados = useQuery({
    queryKey: ["fh_comparacao", atual?.id, anterior?.id],
    enabled: !!atual,
    queryFn: async () => {
      const [resA, resP] = await Promise.all([
        carregarResumos(atual!.id),
        anterior ? carregarResumos(anterior.id) : Promise.resolve(null),
      ]);
      // processos só dos centros com fluxo: a lista dos sem fluxo tem todas as DIs e é grande
      const centros = [
        ...new Set(
          [...resA, ...(resP ?? [])].filter((r) => r.usa_fluxo).map((r) => r.centro_custo),
        ),
      ];
      const [pendA, pendP] = await Promise.all([
        carregarPendencias(atual!.id, centros),
        anterior ? carregarPendencias(anterior.id, centros) : Promise.resolve(null),
      ]);
      return { resA, resP, pendA, pendP, centrosComLista: new Set(centros) };
    },
  });

  // filtro de centros, lembrado neste navegador
  const [centrosSel, setCentrosSel] = useState<string[]>([]);
  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_CENTROS) ?? "[]");
      if (Array.isArray(salvo)) setCentrosSel(salvo);
    } catch {
      /* sem armazenamento: começa com todos */
    }
  }, []);
  const salvarCentros = (v: string[]) => {
    setCentrosSel(v);
    try {
      localStorage.setItem(CHAVE_CENTROS, JSON.stringify(v));
    } catch {
      /* ignora */
    }
  };
  const noFiltro = (c: string) => !centrosSel.length || centrosSel.includes(c);

  const comp = useMemo(() => {
    if (!dados.data) return null;
    const { resA, resP, pendA, pendP, centrosComLista } = dados.data;
    const linhas = compararCentros(resA, resP, pendA, pendP, centrosComLista);
    return { linhas, todos: linhas.map((l) => l.centro).sort() };
  }, [dados.data]);

  const visao = useMemo(() => {
    if (!comp || !dados.data) return null;
    const linhas = comp.linhas.filter((l) => noFiltro(l.centro));
    const fl = linhas.filter((l) => l.usa_fluxo);
    const sf = linhas.filter((l) => !l.usa_fluxo);
    const soma = (
      arr: typeof linhas,
      f: (l: (typeof linhas)[number]) => number | null | undefined,
    ) => arr.reduce((s, l) => s + (f(l) ?? 0), 0);
    const comDi = fl.filter((l) => l.atual && l.atual.processos_di > 0);
    const faixasAnt = FAIXA_KEYS.map((k) => soma(fl, (l) => l.anterior?.[k]));
    const faixasAtu = FAIXA_KEYS.map((k) => soma(fl, (l) => l.atual?.[k]));
    return {
      linhas,
      sem: soma(fl, (l) => l.atual?.sem_pedido),
      semAnt: soma(fl, (l) => l.anterior?.sem_pedido),
      m90: soma(fl, (l) => l.atual?.mais_90),
      m90Ant: soma(fl, (l) => l.anterior?.mais_90),
      cobertura: comDi.length
        ? (soma(comDi, (l) => l.atual?.com_pedido) / soma(comDi, (l) => l.atual?.processos_di)) *
          100
        : null,
      entraram: soma(fl, (l) => l.entraram),
      sairam: soma(fl, (l) => l.sairam),
      sfSem: soma(sf, (l) => l.atual?.sem_pedido),
      sfAnt: soma(sf, (l) => l.anterior?.sem_pedido),
      nSf: sf.length,
      faixasAnt,
      faixasAtu,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp, dados.data, centrosSel]);

  const importar = async (file: File) => {
    setImportando(true);
    try {
      const r = await importarFechamento(file, user?.id);
      await qc.invalidateQueries({ queryKey: ["fh_importacoes"] });
      await qc.invalidateQueries({ queryKey: ["fin_fechamento_pendente"] });
      setAtualId(null);
      setAnteriorId(null);
      toast.success(
        `${n0(r.centros)} centros e ${n0(r.processos)} processos importados${r.estimado ? " (resumo estimado do CSV)" : ""}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar o arquivo");
    } finally {
      setImportando(false);
    }
  };

  const botaoImportar = podeEditar && (
    <>
      <Button size="sm" onClick={() => inputRef.current?.click()} disabled={importando}>
        <Upload className="h-4 w-4 mr-1.5" />
        {importando ? "Importando..." : "Importar base do Sigra"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importar(f);
          e.target.value = "";
        }}
      />
    </>
  );

  if (!atual)
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium">
            {imps.isLoading ? "Carregando..." : "Nenhuma base de fechamentos importada"}
          </p>
          <p className="text-sm text-muted-foreground">
            Importe a planilha do Sigra (.xlsx com as abas Resumo, Sem fechamento e Centros sem o
            fluxo) ou o CSV fechamento-pendente-AAAA-MM-DD.csv.
          </p>
          {botaoImportar}
        </CardContent>
      </Card>
    );

  const estimado = resumoEstimado(atual);
  const desde = anterior ? dataBr(anterior.data_referencia ?? anterior.created_at, true) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline">Base</Badge>
        <Select
          value={atual.id}
          onValueChange={(v) => {
            setAtualId(v);
            setAnteriorId(null);
          }}
        >
          <SelectTrigger className="w-56 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {lista.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {rotuloImp(i)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">comparada a</span>
        <Select value={anterior?.id ?? "nenhuma"} onValueChange={setAnteriorId}>
          <SelectTrigger className="w-56 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nenhuma">Sem comparação</SelectItem>
            {lista.slice(idxAtual + 1).map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {rotuloImp(i)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FiltroCentros
          todos={comp?.todos ?? []}
          linhas={comp?.linhas ?? []}
          sel={centrosSel}
          aoMudar={salvarCentros}
        />
        <div className="ml-auto">{botaoImportar}</div>
      </div>
      {estimado && (
        <p className="text-xs text-muted-foreground">
          Esta base veio em CSV, que não traz o resumo: processos com DI e % com pedido são
          estimados a partir da base anterior.
        </p>
      )}

      {!visao ? (
        <p className="text-sm text-muted-foreground">
          {dados.isError ? "Não foi possível carregar a base." : "Carregando..."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Kpi
              alerta
              rotulo="Sem pedido (com fluxo)"
              valor={n0(visao.sem)}
              detalhe={
                desde ? (
                  <>
                    <Delta v={visao.sem - visao.semAnt} /> desde {desde}
                  </>
                ) : (
                  "centros que usam o pedido"
                )
              }
            />
            <Kpi
              alerta
              rotulo="Mais de 90 dias"
              valor={n0(visao.m90)}
              detalhe={
                desde ? (
                  <>
                    <Delta v={visao.m90 - visao.m90Ant} /> desde {desde}
                  </>
                ) : (
                  "prioridade crítica"
                )
              }
            />
            <Kpi
              rotulo="Processos com pedido"
              valor={pct(visao.cobertura, 1)}
              detalhe={`dos processos com DI${estimado ? " · estimado" : ""} · meta 80%`}
            />
            <Kpi
              rotulo="Saíram × entraram"
              valor={desde ? `${n0(visao.sairam)} × ${n0(visao.entraram)}` : "–"}
              detalhe={
                desde ? "processos na lista, centros com fluxo" : "escolha uma base para comparar"
              }
            />
            <Kpi
              rotulo="Centros sem fluxo"
              valor={n0(visao.sfSem)}
              detalhe={
                <>
                  {n0(visao.nSf)} centros listam todas as DIs
                  {desde && (
                    <>
                      {" "}
                      · <Delta v={visao.sfSem - visao.sfAnt} />
                    </>
                  )}
                </>
              }
            />
          </div>

          {anterior && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Envelhecimento: {desde} e agora</CardTitle>
                <CardDescription>
                  Centros com fluxo, por dias sem pedido de fechamento
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <div className="space-y-3">
                  {[
                    ["Anterior", visao.faixasAnt],
                    ["Atual", visao.faixasAtu],
                  ].map(([r, v]) => {
                    const total = (v as number[]).reduce((s, x) => s + x, 0);
                    const max = Math.max(
                      1,
                      visao.faixasAnt.reduce((s, x) => s + x, 0),
                      visao.faixasAtu.reduce((s, x) => s + x, 0),
                    );
                    return (
                      <div key={r as string} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <b>{r as string}</b>
                          <span className="tabular-nums">{n0(total)} processos</span>
                        </div>
                        <div style={{ width: `${(total / max) * 100}%`, minWidth: 4 }}>
                          <Empilhada
                            valores={v as number[]}
                            altura="h-6"
                            largura="w-full"
                            rotulos
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {FAIXAS.map((f, i) => (
                      <span key={f.key} className="flex items-center gap-1">
                        <i
                          className="inline-block w-2.5 h-2.5 rounded-sm"
                          style={{ background: COR_FAIXA[i] }}
                        />
                        {f.label}
                      </span>
                    ))}
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Faixa</TableHead>
                      <TableHead className="text-right">Antes</TableHead>
                      <TableHead className="text-right">Agora</TableHead>
                      <TableHead className="text-right">Variação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {FAIXAS.map((f, i) => (
                      <TableRow key={f.key}>
                        <TableCell className="text-xs">{f.label}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {n0(visao.faixasAnt[i])}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {n0(visao.faixasAtu[i])}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          <Delta v={visao.faixasAtu[i] - visao.faixasAnt[i]} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <TabelaCentros linhas={visao.linhas} temAnterior={!!anterior} />
          <ListaProcessos dados={dados.data!} filtro={noFiltro} temAnterior={!!anterior} />
        </>
      )}
    </div>
  );
}

function FiltroCentros({
  todos,
  linhas,
  sel,
  aoMudar,
}: {
  todos: string[];
  linhas: ReturnType<typeof compararCentros>;
  sel: string[];
  aoMudar: (v: string[]) => void;
}) {
  const [busca, setBusca] = useState("");
  const fluxo = (c: string) => linhas.find((l) => l.centro === c)?.usa_fluxo;
  const crit = (c: string) =>
    situacaoCentro(linhas.find((l) => l.centro === c)?.atual ?? null) === "critico";
  const vis = todos.filter((c) => c.toLowerCase().includes(busca.toLowerCase()));
  const marcar = (c: string, on: boolean) => aoMudar(on ? [...sel, c] : sel.filter((x) => x !== c));
  const resumo = !sel.length
    ? "Todos os centros"
    : sel.length === 1
      ? sel[0]
      : `${sel.length} centros`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Filter className="h-4 w-4 mr-1.5" />
          {resumo}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3 space-y-2" align="start">
        <Input
          placeholder="Buscar centro"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-8"
        />
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => aoMudar([])}>
            Todos
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => aoMudar(todos.filter((c) => fluxo(c)))}
          >
            Só com fluxo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => aoMudar(todos.filter((c) => !fluxo(c)))}
          >
            Só sem fluxo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => aoMudar(todos.filter(crit))}
          >
            Só críticos
          </Button>
        </div>
        <div className="max-h-72 overflow-y-auto space-y-0.5">
          {[
            ["Usam o pedido de fechamento", true],
            ["Não usam o fluxo", false],
          ].map(([titulo, f]) => {
            const grupo = vis.filter((c) => !!fluxo(c) === f);
            return grupo.length ? (
              <div key={titulo as string}>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground pt-2 pb-1">
                  {titulo as string}
                </div>
                {grupo.map((c) => (
                  <label
                    key={c}
                    className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted text-sm cursor-pointer"
                  >
                    <Checkbox checked={sel.includes(c)} onCheckedChange={(v) => marcar(c, !!v)} />
                    <span className="truncate">{c}</span>
                  </label>
                ))}
              </div>
            ) : null;
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">A seleção fica salva neste navegador.</p>
      </PopoverContent>
    </Popover>
  );
}

type Ord = { k: "centro" | "sem" | "delta" | "pct" | "m90" | "di"; d: 1 | -1 };

function TabelaCentros({
  linhas,
  temAnterior,
}: {
  linhas: ReturnType<typeof compararCentros>;
  temAnterior: boolean;
}) {
  const [ord, setOrd] = useState<Ord>({ k: "sem", d: -1 });
  const val = (l: (typeof linhas)[number]) =>
    ({
      centro: l.centro,
      sem: l.atual?.sem_pedido ?? 0,
      delta: l.delta_sem ?? 0,
      pct: l.atual?.percentual_pedido ?? 0,
      m90: l.atual?.mais_90 ?? 0,
      di: l.atual?.processos_di ?? 0,
    })[ord.k];
  const ordenadas = [...linhas].sort((a, b) => {
    const A = val(a),
      B = val(b);
    return (
      (typeof A === "string" ? A.localeCompare(B as string) : (A as number) - (B as number)) * ord.d
    );
  });
  const th = (k: Ord["k"], rotulo: string, cls = "") => (
    <TableHead
      className={cn("cursor-pointer select-none", cls)}
      onClick={() =>
        setOrd(ord.k === k ? { k, d: (ord.d * -1) as 1 | -1 } : { k, d: k === "centro" ? 1 : -1 })
      }
    >
      {rotulo}
      {ord.k === k ? (ord.d < 0 ? " ↓" : " ↑") : ""}
    </TableHead>
  );
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Situação por centro de custo</CardTitle>
        <CardDescription>
          Crítico: 20 ou mais processos com mais de 90 dias, ou menos de 80% com pedido. Atenção:
          algum processo com mais de 60 dias.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {th("centro", "Centro")}
              <TableHead>Situação</TableHead>
              {th("di", "Processos com DI", "text-right")}
              {th("pct", "% com pedido")}
              {th("sem", "Sem pedido", "text-right")}
              {temAnterior && th("delta", "Variação", "text-right")}
              {temAnterior && <TableHead className="text-right">Entraram</TableHead>}
              {temAnterior && <TableHead className="text-right">Saíram</TableHead>}
              <TableHead>Por faixa</TableHead>
              {th("m90", "+90 dias", "text-right")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenadas.map((l) => {
              const s = SITUACAO[situacaoCentro(l.atual)];
              return (
                <TableRow key={l.centro}>
                  <TableCell className="font-medium whitespace-nowrap">{l.centro}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full",
                        s.cls,
                      )}
                    >
                      {s.rotulo}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {n0(l.atual?.processos_di)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-32">
                      <Progress
                        value={Math.min(l.atual?.percentual_pedido ?? 0, 100)}
                        className="h-1.5"
                      />
                      <span className="text-xs w-10 text-right tabular-nums">
                        {pct(l.atual?.percentual_pedido)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {n0(l.atual?.sem_pedido ?? 0)}
                  </TableCell>
                  {temAnterior && (
                    <TableCell className="text-right text-xs">
                      <Delta v={l.delta_sem} />
                    </TableCell>
                  )}
                  {temAnterior && (
                    <TableCell className="text-right tabular-nums">{n0(l.entraram)}</TableCell>
                  )}
                  {temAnterior && (
                    <TableCell className="text-right tabular-nums">{n0(l.sairam)}</TableCell>
                  )}
                  <TableCell>
                    <Empilhada valores={valoresFaixa(l.atual)} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {n0(l.atual?.mais_90 ?? 0)}
                    {temAnterior && (
                      <div className="text-[11px]">
                        <Delta v={l.delta_90} />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

const POR_PAGINA = 50;

function ListaProcessos({
  dados,
  filtro,
  temAnterior,
}: {
  dados: { pendA: LinhaPendencia[]; pendP: LinhaPendencia[] | null };
  filtro: (c: string) => boolean;
  temAnterior: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [centro, setCentro] = useState("todos");
  const [faixas, setFaixas] = useState<string[]>([]);
  const [soNovos, setSoNovos] = useState(false);
  const [pagina, setPagina] = useState(0);
  const anteriores = useMemo(() => new Set((dados.pendP ?? []).map(chavePendencia)), [dados.pendP]);
  const base = dados.pendA.filter((p) => p.usa_fluxo && filtro(p.centro_custo));
  const centros = [...new Set(base.map((p) => p.centro_custo))].sort();
  const q = busca.trim().toLowerCase();
  const linhas = base
    .filter((p) => centro === "todos" || p.centro_custo === centro)
    .filter((p) => !faixas.length || faixas.includes(faixaDe(p)))
    .filter((p) => !soNovos || !anteriores.has(chavePendencia(p)))
    .filter(
      (p) => !q || `${p.processo} ${p.cliente ?? ""} ${p.di_duimp ?? ""}`.toLowerCase().includes(q),
    )
    .sort((a, b) => b.dias_sem_pedido - a.dias_sem_pedido);
  const paginas = Math.max(1, Math.ceil(linhas.length / POR_PAGINA));
  const pg = Math.min(pagina, paginas - 1);
  const contagem = contarFaixas(linhas);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Processos sem pedido de fechamento</CardTitle>
        <CardDescription>
          Centros que usam o fluxo. A lista dos centros sem fluxo traz todas as DIs e fica fora
          desta tabela.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-56">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              className="pl-8 h-9"
              placeholder="Buscar processo, cliente ou DI/DUIMP"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(0);
              }}
            />
          </div>
          <Select
            value={centro}
            onValueChange={(v) => {
              setCentro(v);
              setPagina(0);
            }}
          >
            <SelectTrigger className="w-60 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os centros</SelectItem>
              {centros.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          {FAIXAS.map((f, i) => {
            const on = faixas.includes(f.key);
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setFaixas(on ? faixas.filter((x) => x !== f.key) : [...faixas, f.key]);
                  setPagina(0);
                }}
                className={cn(
                  "text-xs border rounded-full px-2.5 py-1 flex items-center gap-1.5",
                  on ? "border-primary bg-primary/10" : "border-border",
                )}
              >
                <i
                  className="inline-block w-2 h-2 rounded-sm"
                  style={{ background: COR_FAIXA[i] }}
                />
                {f.label}
              </button>
            );
          })}
          {temAnterior && (
            <button
              type="button"
              onClick={() => {
                setSoNovos(!soNovos);
                setPagina(0);
              }}
              className={cn(
                "text-xs border rounded-full px-2.5 py-1",
                soNovos ? "border-primary bg-primary/10" : "border-border",
              )}
            >
              Só os que entraram
            </button>
          )}
          <div className="ml-auto">
            <BotaoCopiar
              cabecalho={[
                "Centro de custo",
                "Processo",
                "Cliente",
                "DI/DUIMP",
                "Data de registro",
                "Dias sem pedir fechamento",
                "Faixa",
                "Novo",
              ]}
              linhas={linhas.map((p) => [
                p.centro_custo,
                p.processo,
                p.cliente,
                p.di_duimp,
                dataBr(p.data_registro),
                p.dias_sem_pedido,
                FAIXAS.find((f) => f.key === faixaDe(p))!.label,
                temAnterior ? (anteriores.has(chavePendencia(p)) ? "Não" : "Sim") : "",
              ])}
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          <b className="text-foreground tabular-nums">{n0(linhas.length)}</b> processos ·{" "}
          {n0(contagem.mais_90)} com mais de 90 dias
        </p>
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Centro</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>DI/DUIMP</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead className="text-right">Dias</TableHead>
                <TableHead>Faixa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.slice(pg * POR_PAGINA, (pg + 1) * POR_PAGINA).map((p) => {
                const fi = FAIXA_KEYS.indexOf(faixaDe(p));
                return (
                  <TableRow key={chavePendencia(p)}>
                    <TableCell className="text-xs whitespace-nowrap">{p.centro_custo}</TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {p.processo}
                      {temAnterior && !anteriores.has(chavePendencia(p)) && (
                        <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                          Novo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs max-w-48 truncate">{p.cliente ?? "–"}</TableCell>
                    <TableCell className="font-mono text-xs">{p.di_duimp ?? "–"}</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {dataBr(p.data_registro)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        fi >= 3 && "text-destructive",
                      )}
                    >
                      {p.dias_sem_pedido}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      <i
                        className="inline-block w-2 h-2 rounded-sm mr-1.5"
                        style={{ background: COR_FAIXA[fi] }}
                      />
                      {FAIXAS[fi].label}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!linhas.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    Nenhum processo com esses filtros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {pg + 1} de {paginas}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pg === 0}
              onClick={() => setPagina(pg - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pg >= paginas - 1}
              onClick={() => setPagina(pg + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
