import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Search, Upload } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  avaliarColaboradores,
  diasEmAberto,
  empresasDe,
  type ColaboradorAvaliado,
  type SituacaoColab,
} from "@/lib/hub-adesao";
import {
  carregarFrequencia,
  carregarOnboarding,
  importarFrequencia,
  importarOnboarding,
  tabelaAusente,
} from "./dados";
import { Barras, BotaoCopiar, Kpi } from "./ui";
import { dataBr, n0, pct } from "./formato";

const COR_SIT: Record<SituacaoColab, string> = {
  Crítico: "bg-destructive/10 text-destructive",
  Atenção: "bg-warning/15 text-warning",
  "Em dia": "bg-success/10 text-success",
};
const VERDE = "var(--color-success)";
const NEUTRO = "var(--color-muted-foreground)";
const AMARELO = "var(--color-warning)";
const VERMELHO = "var(--color-destructive)";

function BotaoImportar({
  rotulo,
  aoEscolher,
  ocupado,
}: {
  rotulo: string;
  aoEscolher: (f: File) => void;
  ocupado: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => ref.current?.click()} disabled={ocupado}>
        <Upload className="h-4 w-4 mr-1.5" />
        {ocupado ? "Importando..." : rotulo}
      </Button>
      <input
        ref={ref}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) aoEscolher(f);
          e.target.value = "";
        }}
      />
    </>
  );
}

function AvisoMigration() {
  return (
    <Card className="border-l-4 border-l-warning">
      <CardContent className="py-4 text-sm flex gap-2">
        <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <span>
          As tabelas do Hub ainda não existem no banco. Aplique a migration do Hub{" "}
          no Lovable para liberar a importação.
        </span>
      </CardContent>
    </Card>
  );
}

export function HubTab({ podeEditar }: { podeEditar: boolean }) {
  return (
    <div className="space-y-6">
      <Adesao podeEditar={podeEditar} />
      <Onboarding podeEditar={podeEditar} />
    </div>
  );
}

// ── Adesão dos colaboradores ─────────────────────────────────────────

function Adesao({ podeEditar }: { podeEditar: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const q = useQuery({
    queryKey: ["hub_frequencia"],
    queryFn: carregarFrequencia,
    retry: (n, e) => !tabelaAusente(e) && n < 2,
  });
  const [empresa, setEmpresa] = useState("todas");
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [sit, setSit] = useState<"pend" | "todos" | SituacaoColab>("pend");

  const av = useMemo(() => (q.data ? avaliarColaboradores(q.data.linhas) : null), [q.data]);

  const importar = async (f: File) => {
    setOcupado(true);
    try {
      const n = await importarFrequencia(f, user?.id);
      await qc.invalidateQueries({ queryKey: ["hub_frequencia"] });
      toast.success(`${n0(n)} colaboradores importados`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar o arquivo");
    } finally {
      setOcupado(false);
    }
  };

  const cab = (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold">Adesão dos colaboradores</h2>
        <p className="text-sm text-muted-foreground">
          {q.data
            ? `Export de ${dataBr(q.data.importacao.data_referencia ?? q.data.importacao.created_at)} · acessos até ${dataBr(av?.referencia)} · ${n0(q.data.linhas.length)} colaboradores`
            : "Treinamento, acesso ao Hub e uso de dashboard por colaborador"}
        </p>
      </div>
      {podeEditar && !tabelaAusente(q.error) && (
        <BotaoImportar rotulo="Importar frequência" aoEscolher={importar} ocupado={ocupado} />
      )}
    </div>
  );

  if (tabelaAusente(q.error))
    return (
      <div className="space-y-3">
        {cab}
        <AvisoMigration />
      </div>
    );
  if (!av || !q.data)
    return (
      <div className="space-y-3">
        {cab}
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {q.isLoading
              ? "Carregando..."
              : "Nenhum arquivo importado. Use o frequencia-colaboradores-AAAA-MM-DD.csv exportado do Hub."}
          </CardContent>
        </Card>
      </div>
    );

  const empresas = [...new Set(av.pessoas.flatMap((p) => empresasDe(p.empresa)))].sort();
  const base = av.pessoas.filter(
    (p) => empresa === "todas" || empresasDe(p.empresa).includes(empresa),
  );
  const n = base.length || 1;
  const conta = (f: (p: ColaboradorAvaliado) => boolean) => base.filter(f).length;
  const notas = base.filter((p) => p.nota !== null);
  const tipos: Record<string, number> = {};
  base.forEach((p) => p.pendencias.forEach((t) => (tipos[t] = (tipos[t] ?? 0) + 1)));
  const modulos: Record<string, number> = {};
  base.forEach((p) =>
    (p.treinamentos_pendentes ?? "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((m) => (modulos[m] = (modulos[m] ?? 0) + 1)),
  );

  const termo = busca.trim().toLowerCase();
  const lista = base
    .filter(
      (p) =>
        !termo ||
        `${p.colaborador} ${p.cargo ?? ""} ${p.empresa ?? ""}`.toLowerCase().includes(termo),
    )
    .filter((p) => tipo === "todos" || p.pendencias.includes(tipo))
    .filter((p) =>
      sit === "todos" ? true : sit === "pend" ? p.pendencias.length > 0 : p.situacao === sit,
    )
    .sort(
      (a, b) =>
        ["Crítico", "Atenção", "Em dia"].indexOf(a.situacao) -
          ["Crítico", "Atenção", "Em dia"].indexOf(b.situacao) ||
        (b.dias_sem_acesso ?? 999) - (a.dias_sem_acesso ?? 999) ||
        a.colaborador.localeCompare(b.colaborador),
    );

  const porEmpresa = empresas
    .map((e) => {
      const ps = av.pessoas.filter((p) => empresasDe(p.empresa).includes(e));
      return {
        e,
        n: ps.length,
        tr: ps.filter((p) => p.treinamento_concluidos === 3).length / ps.length,
        at:
          ps.filter((p) => p.dias_sem_acesso !== null && p.dias_sem_acesso <= 7).length / ps.length,
        hub: ps.reduce((s, p) => s + p.hub_dias_30, 0) / ps.length,
        pend: ps.filter((p) => p.pendencias.length).length,
        cr: ps.filter((p) => p.situacao === "Crítico").length,
      };
    })
    .sort((a, b) => b.n - a.n);

  return (
    <div className="space-y-4">
      {cab}
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Empresa</span>
        <Select value={empresa} onValueChange={setEmpresa}>
          <SelectTrigger className="w-64 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as empresas</SelectItem>
            {empresas.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi
          alerta
          rotulo="Com pendências"
          valor={n0(conta((p) => p.pendencias.length > 0))}
          detalhe={`de ${n0(base.length)} colaboradores`}
        />
        <Kpi
          alerta
          rotulo="Situação crítica"
          valor={n0(conta((p) => p.situacao === "Crítico"))}
          detalhe="nunca acessou, +14 dias sem acesso, ou sem treinamento e pouco uso"
        />
        <Kpi
          rotulo="Treinamento completo"
          valor={pct((conta((p) => p.treinamento_concluidos === 3) / n) * 100)}
          detalhe={`${n0(conta((p) => p.treinamento_concluidos === 0))} não iniciaram`}
        />
        <Kpi
          rotulo="Acessaram nos últimos 7 dias"
          valor={pct(
            (conta((p) => p.dias_sem_acesso !== null && p.dias_sem_acesso <= 7) / n) * 100,
          )}
          detalhe={`${n0(conta((p) => p.dias_sem_acesso === null))} nunca acessaram`}
        />
        <Kpi
          rotulo="Dias de acesso em 30"
          valor={(base.reduce((s, p) => s + p.hub_dias_30, 0) / n).toLocaleString("pt-BR", {
            maximumFractionDigits: 1,
          })}
          detalhe="média por colaborador"
        />
        <Kpi
          rotulo="Usam dashboard"
          valor={pct((conta((p) => p.dashboard_dias_30 > 0) / n) * 100)}
          detalhe={`nota média ${notas.length ? pct(notas.reduce((s, p) => s + (p.nota ?? 0), 0) / notas.length) : "–"} nos questionários`}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Treinamento</CardTitle>
            <CardDescription>Módulos concluídos de 3</CardDescription>
          </CardHeader>
          <CardContent>
            <Barras
              itens={[3, 2, 1, 0].map((k, i) => ({
                rotulo: `${k}/3${k === 3 ? " completo" : k === 0 ? " não iniciado" : ""}`,
                valor: conta((p) => p.treinamento_concluidos === k),
                total: base.length,
                cor: [VERDE, NEUTRO, AMARELO, VERMELHO][i],
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Frequência no Hub</CardTitle>
            <CardDescription>Dias com acesso em 30 (cerca de 22 úteis)</CardDescription>
          </CardHeader>
          <CardContent>
            <Barras
              itens={(
                [
                  ["20 dias ou mais", 20, 99, VERDE],
                  ["10 a 19 dias", 10, 19, NEUTRO],
                  ["5 a 9 dias", 5, 9, AMARELO],
                  ["1 a 4 dias", 1, 4, VERMELHO],
                  ["Nenhum dia", 0, 0, VERMELHO],
                ] as const
              ).map(([r, a, b, cor]) => ({
                rotulo: r,
                valor: conta((p) => p.hub_dias_30 >= a && p.hub_dias_30 <= b),
                total: base.length,
                cor,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Último acesso</CardTitle>
            <CardDescription>Dias desde o último acesso ao Hub</CardDescription>
          </CardHeader>
          <CardContent>
            <Barras
              itens={[
                ...(
                  [
                    ["Hoje ou ontem", 0, 1, VERDE],
                    ["2 a 7 dias", 2, 7, NEUTRO],
                    ["8 a 14 dias", 8, 14, AMARELO],
                    ["15 a 30 dias", 15, 30, VERMELHO],
                    ["Mais de 30 dias", 31, 1e5, VERMELHO],
                  ] as const
                ).map(([r, a, b, cor]) => ({
                  rotulo: r,
                  valor: conta(
                    (p) =>
                      p.dias_sem_acesso !== null &&
                      p.dias_sem_acesso >= a &&
                      p.dias_sem_acesso <= b,
                  ),
                  total: base.length,
                  cor,
                })),
                {
                  rotulo: "Nunca acessou",
                  valor: conta((p) => p.dias_sem_acesso === null),
                  total: base.length,
                  cor: VERMELHO,
                },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tipos de pendência</CardTitle>
            <CardDescription>Clique para filtrar a lista</CardDescription>
          </CardHeader>
          <CardContent>
            <Barras
              ativo={tipo}
              aoClicar={(r) => {
                setTipo(tipo === r ? "todos" : r);
                setSit("todos");
              }}
              itens={Object.entries(tipos)
                .sort((a, b) => b[1] - a[1])
                .map(([r, v]) => ({ rotulo: r, valor: v, total: base.length }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Módulos pendentes</CardTitle>
            <CardDescription>Colaboradores sem o módulo concluído</CardDescription>
          </CardHeader>
          <CardContent>
            <Barras
              itens={Object.entries(modulos)
                .sort((a, b) => b[1] - a[1])
                .map(([r, v]) => ({ rotulo: r, valor: v, total: base.length, cor: VERMELHO }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Por empresa</CardTitle>
            <CardDescription>
              Clique para filtrar · quem atende várias conta em cada uma
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Pessoas</TableHead>
                  <TableHead className="text-right">3/3</TableHead>
                  <TableHead className="text-right">Ativos 7d</TableHead>
                  <TableHead className="text-right">Críticos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porEmpresa.map((r) => (
                  <TableRow
                    key={r.e}
                    className={cn("cursor-pointer", empresa === r.e && "bg-primary/5")}
                    onClick={() => setEmpresa(empresa === r.e ? "todas" : r.e)}
                  >
                    <TableCell className="font-medium text-xs">{r.e}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.n}</TableCell>
                    <TableCell
                      className={cn("text-right tabular-nums", r.tr < 0.5 && "text-destructive")}
                    >
                      {pct(r.tr * 100)}
                    </TableCell>
                    <TableCell
                      className={cn("text-right tabular-nums", r.at < 0.7 && "text-destructive")}
                    >
                      {pct(r.at * 100)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        r.cr > 0 && "text-destructive font-medium",
                      )}
                    >
                      {r.cr}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Colaboradores e pendências</CardTitle>
          <CardDescription>
            Pendência: treinamento incompleto; nunca acessou ou mais de 7 dias sem acesso; menos de
            10 dias de uso em 30; nenhum uso de dashboard em 30 dias; nota abaixo de 80%.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-56">
              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                className="pl-8 h-9"
                placeholder="Buscar colaborador, cargo ou empresa"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="w-64 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos de pendência</SelectItem>
                {Object.keys(tipos)
                  .sort()
                  .map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            {(
              [
                ["pend", "Com pendências"],
                ["todos", "Todos"],
                ["Crítico", "Crítico"],
                ["Atenção", "Atenção"],
                ["Em dia", "Em dia"],
              ] as const
            ).map(([v, r]) => (
              <button
                key={v}
                type="button"
                onClick={() => setSit(v)}
                className={cn(
                  "text-xs border rounded-full px-2.5 py-1",
                  sit === v ? "border-primary bg-primary/10" : "border-border",
                )}
              >
                {r}
              </button>
            ))}
            <span className="text-sm text-muted-foreground ml-2">
              <b className="text-foreground tabular-nums">{n0(lista.length)}</b> de{" "}
              {n0(base.length)}
            </span>
            <div className="ml-auto">
              <BotaoCopiar
                cabecalho={[
                  "Colaborador",
                  "Situação",
                  "Cargo",
                  "Empresa",
                  "Treinamento",
                  "Nota",
                  "Hub (dias em 30)",
                  "Dias sem acesso",
                  "Dashboard (dias em 30)",
                  "Pendências",
                  "Módulos pendentes",
                ]}
                linhas={lista.map((p) => [
                  p.colaborador,
                  p.situacao,
                  p.cargo,
                  p.empresa,
                  `${p.treinamento_concluidos}/3`,
                  p.nota === null ? "" : pct(p.nota),
                  p.hub_dias_30,
                  p.dias_sem_acesso ?? "nunca acessou",
                  p.dashboard_dias_30,
                  p.pendencias.join(" · "),
                  p.treinamentos_pendentes,
                ])}
              />
            </div>
          </div>
          <div className="border rounded-md overflow-auto max-h-[36rem]">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Treinamento</TableHead>
                  <TableHead className="text-right">Nota</TableHead>
                  <TableHead className="text-right">Hub (dias em 30)</TableHead>
                  <TableHead className="text-right">Dias sem acesso</TableHead>
                  <TableHead className="text-right">Dashboard</TableHead>
                  <TableHead>Pendências</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((p, i) => (
                  <TableRow key={`${p.colaborador}-${i}`}>
                    <TableCell className="font-medium text-xs whitespace-nowrap">
                      {p.colaborador}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full whitespace-nowrap",
                          COR_SIT[p.situacao],
                        )}
                      >
                        {p.situacao}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{p.cargo ?? "–"}</TableCell>
                    <TableCell className="text-xs min-w-32">{p.empresa ?? "–"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.treinamento_concluidos}/3
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.nota === null ? "–" : pct(p.nota)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.hub_dias_30}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        (p.dias_sem_acesso === null || p.dias_sem_acesso > 7) && "text-destructive",
                      )}
                    >
                      {p.dias_sem_acesso ?? "nunca"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.dashboard_dias_30}</TableCell>
                    <TableCell className="text-xs min-w-56">
                      {p.pendencias.join(" · ") || (
                        <span className="text-success">Sem pendências</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!lista.length && (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      Nenhum colaborador com esses filtros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Pendências de onboarding ─────────────────────────────────────────

const SEM_RESP = "Sem responsável";

function Onboarding({ podeEditar }: { podeEditar: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const q = useQuery({
    queryKey: ["hub_onboarding"],
    queryFn: carregarOnboarding,
    retry: (n, e) => !tabelaAusente(e) && n < 2,
  });
  const [empresa, setEmpresa] = useState("todas");
  const [resp, setResp] = useState("todos");
  const [busca, setBusca] = useState("");

  const importar = async (f: File) => {
    setOcupado(true);
    try {
      const n = await importarOnboarding(f, user?.id);
      await qc.invalidateQueries({ queryKey: ["hub_onboarding"] });
      toast.success(`${n0(n)} itens de onboarding importados`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar o arquivo");
    } finally {
      setOcupado(false);
    }
  };

  const ref = q.data
    ? (q.data.importacao.data_referencia ?? q.data.importacao.created_at.slice(0, 10))
    : null;
  const itens = useMemo(
    () =>
      (q.data?.linhas ?? []).map((l) => ({
        ...l,
        resp: l.responsavel || SEM_RESP,
        dias: diasEmAberto(l.desde, ref),
      })),
    [q.data, ref],
  );

  const cab = (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold">Pendências de onboarding</h2>
        <p className="text-sm text-muted-foreground">
          {q.data
            ? `Lista de ${dataBr(ref)} · ${n0(itens.length)} itens abertos`
            : "O que falta na implantação do Hub em cada empresa"}
        </p>
      </div>
      {podeEditar && !tabelaAusente(q.error) && (
        <BotaoImportar rotulo="Importar onboarding" aoEscolher={importar} ocupado={ocupado} />
      )}
    </div>
  );

  if (tabelaAusente(q.error))
    return (
      <div className="space-y-3">
        {cab}
        <AvisoMigration />
      </div>
    );
  if (!q.data)
    return (
      <div className="space-y-3">
        {cab}
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {q.isLoading
              ? "Carregando..."
              : "Nenhum arquivo importado. Use o pendencias-onboarding-AAAA-MM-DD.csv."}
          </CardContent>
        </Card>
      </div>
    );

  const agrupar = (k: "empresa" | "resp") => {
    const g: Record<string, number[]> = {};
    itens.forEach((i) => (g[i[k]] = [...(g[i[k]] ?? []), i.dias ?? 0]));
    return Object.entries(g)
      .map(([r, ds]) => ({ rotulo: r, valor: ds.length, max: Math.max(...ds) }))
      .sort((a, b) => b.valor - a.valor || b.max - a.max);
  };
  const porEmpresa = agrupar("empresa");
  const porResp = agrupar("resp");
  const termo = busca.trim().toLowerCase();
  const lista = itens
    .filter((i) => empresa === "todas" || i.empresa === empresa)
    .filter((i) => resp === "todos" || i.resp === resp)
    .filter((i) => !termo || `${i.empresa} ${i.item} ${i.resp}`.toLowerCase().includes(termo))
    .sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1) || a.empresa.localeCompare(b.empresa));
  const maisAntigo = Math.max(0, ...itens.map((i) => i.dias ?? 0));

  return (
    <div className="space-y-4">
      {cab}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          rotulo="Itens abertos"
          valor={n0(itens.length)}
          detalhe={`em ${n0(porEmpresa.length)} empresas`}
        />
        <Kpi
          alerta
          rotulo="Abertos há mais de 14 dias"
          valor={n0(itens.filter((i) => (i.dias ?? 0) > 14).length)}
          detalhe={`o mais antigo tem ${maisAntigo} dias`}
        />
        <Kpi
          rotulo="Com a Codifica"
          valor={n0(itens.filter((i) => /codifica/i.test(i.resp)).length)}
          detalhe="desenvolvimento e configuração"
        />
        <Kpi
          alerta={itens.some((i) => i.resp === SEM_RESP)}
          rotulo="Sem responsável"
          valor={n0(itens.filter((i) => i.resp === SEM_RESP).length)}
          detalhe="itens sem ninguém atribuído"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Itens por empresa</CardTitle>
            <CardDescription>
              Clique para filtrar · vermelho: algum item com mais de 14 dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Barras
              ativo={empresa}
              aoClicar={(r) => setEmpresa(empresa === r ? "todas" : r)}
              itens={porEmpresa.map((g) => ({
                rotulo: g.rotulo,
                valor: g.valor,
                nota: `até ${g.max}d`,
                cor: g.max > 14 ? VERMELHO : undefined,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Com quem está</CardTitle>
            <CardDescription>Clique para filtrar</CardDescription>
          </CardHeader>
          <CardContent>
            <Barras
              ativo={resp}
              aoClicar={(r) => setResp(resp === r ? "todos" : r)}
              itens={porResp.map((g) => ({
                rotulo: g.rotulo,
                valor: g.valor,
                nota: `até ${g.max}d`,
                cor: g.max > 14 ? VERMELHO : undefined,
              }))}
            />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-56">
              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                className="pl-8 h-9"
                placeholder="Buscar item, empresa ou responsável"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Select value={empresa} onValueChange={setEmpresa}>
              <SelectTrigger className="w-56 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as empresas</SelectItem>
                {porEmpresa.map((g) => (
                  <SelectItem key={g.rotulo} value={g.rotulo}>
                    {g.rotulo} ({g.valor})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={resp} onValueChange={setResp}>
              <SelectTrigger className="w-52 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os responsáveis</SelectItem>
                {porResp.map((g) => (
                  <SelectItem key={g.rotulo} value={g.rotulo}>
                    {g.rotulo} ({g.valor})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <BotaoCopiar
              cabecalho={["Empresa", "O que falta", "Com quem", "Desde", "Dias em aberto"]}
              linhas={lista.map((i) => [i.empresa, i.item, i.resp, dataBr(i.desde), i.dias])}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            <b className="text-foreground tabular-nums">{n0(lista.length)}</b> de {n0(itens.length)}{" "}
            itens
          </p>
          <div className="border rounded-md overflow-auto max-h-[32rem]">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>O que falta</TableHead>
                  <TableHead>Com quem</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead className="text-right">Dias em aberto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((i, k) => (
                  <TableRow key={`${i.empresa}-${k}-${i.item}`}>
                    <TableCell className="font-medium text-xs whitespace-nowrap">
                      {i.empresa}
                    </TableCell>
                    <TableCell className="text-sm min-w-72">{i.item}</TableCell>
                    <TableCell
                      className={cn(
                        "text-xs whitespace-nowrap",
                        i.resp === SEM_RESP && "italic text-muted-foreground",
                      )}
                    >
                      {i.resp}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{dataBr(i.desde)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        (i.dias ?? 0) > 14
                          ? "text-destructive"
                          : (i.dias ?? 0) > 7 && "text-warning",
                      )}
                    >
                      {i.dias ?? "–"}
                    </TableCell>
                  </TableRow>
                ))}
                {!lista.length && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      Nenhum item com esses filtros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
