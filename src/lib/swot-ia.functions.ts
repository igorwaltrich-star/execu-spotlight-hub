import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SwotIAResult = {
  insight: string;
  forcas: string[];
  fraquezas: string[];
  oportunidades: string[];
  ameacas: string[];
};

const tool = {
  type: "function",
  function: {
    name: "registrar_swot",
    description:
      "Registra o diagnóstico executivo e os quatro quadrantes da análise SWOT a partir dos dados operacionais e financeiros.",
    parameters: {
      type: "object",
      properties: {
        insight: {
          type: "string",
          description:
            "Diagnóstico executivo em português do Brasil (5 a 10 frases) citando NÚMEROS concretos: volume total e variação, produtividade por pessoa, custo total e custo por processo, atendimento de SLA vs meta de 90%, perdas e recuperações de não conformidades, savings e custos extras.",
        },
        forcas: {
          type: "array",
          items: { type: "string" },
          description: "3 a 6 forças internas, cada item citando o número que a sustenta.",
        },
        fraquezas: {
          type: "array",
          items: { type: "string" },
          description: "3 a 6 fraquezas internas, cada item citando o número que a sustenta.",
        },
        oportunidades: {
          type: "array",
          items: { type: "string" },
          description: "3 a 6 oportunidades acionáveis, cada item citando o número que a sustenta.",
        },
        ameacas: {
          type: "array",
          items: { type: "string" },
          description: "3 a 6 ameaças/riscos, cada item citando o número que o sustenta.",
        },
      },
      required: ["insight", "forcas", "fraquezas", "oportunidades", "ameacas"],
      additionalProperties: false,
    },
  },
} as const;

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (n: number, d = 1) => n.toLocaleString("pt-BR", { maximumFractionDigits: d });

function mesesRecentes(n: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - (n - 1));
  return d.toISOString().slice(0, 10);
}

export const gerarSwotIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SwotIAResult> => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const supabase = context.supabase;
    const desde = mesesRecentes(12);

    const [op, custos, ncs, midea, bosch, oportunidades] = await Promise.all([
      supabase
        .from("operacional_mensal")
        .select("mes, unidade, volume, pessoas, produtividade")
        .gte("mes", desde)
        .order("mes"),
      supabase
        .from("custo_pessoal_mensal")
        .select("mes_referencia, operacao, total, salario_bruto, beneficios")
        .gte("mes_referencia", desde),
      supabase
        .from("nao_conformidades")
        .select("data_ocorrencia, operacao, tipo, custo_gerado, valor_recuperado, status_financeiro")
        .gte("data_ocorrencia", desde),
      supabase.from("sla_midea").select("mes, unidade, otd, otcc, start_up").gte("mes", desde).order("mes"),
      supabase
        .from("sla_bosch")
        .select("mes, planta, otcc, start_up, pinho, dig_conf, desvios")
        .gte("mes", desde)
        .order("mes"),
      supabase.from("oportunidades").select("titulo, categoria, status, savings, custo_extra, data").gte("data", desde),
    ]);

    const opRows = op.data ?? [];
    const custoRows = custos.data ?? [];
    const ncRows = ncs.data ?? [];
    const mideaRows = midea.data ?? [];
    const boschRows = bosch.data ?? [];
    const oportRows = oportunidades.data ?? [];

    const totalRegistros =
      opRows.length + custoRows.length + ncRows.length + mideaRows.length + boschRows.length + oportRows.length;
    if (totalRegistros === 0) {
      throw new Error(
        "Não há dados operacionais ou financeiros cadastrados nos últimos 12 meses para gerar o insight.",
      );
    }

    // --- Agregações -------------------------------------------------------
    const volTotal = opRows.reduce((s, r) => s + Number(r.volume ?? 0), 0);
    const custoTotal = custoRows.reduce((s, r) => s + Number(r.total ?? 0), 0);
    const ncCusto = ncRows.reduce((s, r) => s + Number(r.custo_gerado ?? 0), 0);
    const ncRecuperado = ncRows.reduce((s, r) => s + Number(r.valor_recuperado ?? 0), 0);
    const savings = oportRows.reduce((s, r) => s + Number(r.savings ?? 0), 0);
    const custoExtra = oportRows.reduce((s, r) => s + Number(r.custo_extra ?? 0), 0);

    const porMes = new Map<string, { vol: number; pessoas: number }>();
    for (const r of opRows) {
      const k = String(r.mes).slice(0, 7);
      const cur = porMes.get(k) ?? { vol: 0, pessoas: 0 };
      cur.vol += Number(r.volume ?? 0);
      cur.pessoas += Number(r.pessoas ?? 0);
      porMes.set(k, cur);
    }
    const linhasMes = [...porMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([m, v]) =>
          `${m}: volume ${num(v.vol, 0)} | pessoas ${num(v.pessoas, 0)} | produtividade ${
            v.pessoas > 0 ? num(v.vol / v.pessoas) : "-"
          }`,
      );

    const porOp = new Map<string, { vol: number; pessoas: number }>();
    for (const r of opRows) {
      const k = String(r.unidade);
      const cur = porOp.get(k) ?? { vol: 0, pessoas: 0 };
      cur.vol += Number(r.volume ?? 0);
      cur.pessoas = Math.max(cur.pessoas, Number(r.pessoas ?? 0));
      porOp.set(k, cur);
    }
    const linhasOp = [...porOp.entries()].map(
      ([k, v]) =>
        `${k}: volume acumulado ${num(v.vol, 0)} | pico de pessoas ${num(v.pessoas, 0)} | produtividade média ${
          v.pessoas > 0 ? num(v.vol / v.pessoas) : "-"
        }`,
    );

    const custoPorOp = new Map<string, number>();
    for (const r of custoRows) {
      custoPorOp.set(String(r.operacao), (custoPorOp.get(String(r.operacao)) ?? 0) + Number(r.total ?? 0));
    }
    const linhasCusto = [...custoPorOp.entries()].map(([k, v]) => `${k}: ${brl(v)}`);

    const ncPorTipo = new Map<string, { qtd: number; custo: number }>();
    for (const r of ncRows) {
      const k = String(r.tipo ?? "Não classificado");
      const cur = ncPorTipo.get(k) ?? { qtd: 0, custo: 0 };
      cur.qtd += 1;
      cur.custo += Number(r.custo_gerado ?? 0);
      ncPorTipo.set(k, cur);
    }
    const linhasNC = [...ncPorTipo.entries()]
      .sort((a, b) => b[1].custo - a[1].custo)
      .map(([k, v]) => `${k}: ${v.qtd} ocorrências | ${brl(v.custo)} de custo gerado`);

    const mediaSla = (rows: Record<string, unknown>[], campos: string[], chaveGrupo: string) => {
      const grupos = new Map<string, { soma: Record<string, number>; n: number }>();
      for (const r of rows) {
        const k = String(r[chaveGrupo] ?? "Geral");
        const cur = grupos.get(k) ?? { soma: Object.fromEntries(campos.map((c) => [c, 0])), n: 0 };
        for (const c of campos) cur.soma[c] += Number(r[c] ?? 0);
        cur.n += 1;
        grupos.set(k, cur);
      }
      return [...grupos.entries()].map(
        ([k, v]) =>
          `${k}: ` + campos.map((c) => `${c.toUpperCase()} ${num(v.n ? v.soma[c] / v.n : 0)}%`).join(" | "),
      );
    };

    const linhasMidea = mediaSla(mideaRows as Record<string, unknown>[], ["otd", "otcc", "start_up"], "unidade");
    const linhasBosch = mediaSla(
      boschRows as Record<string, unknown>[],
      ["otcc", "start_up", "pinho", "dig_conf"],
      "planta",
    );

    const linhasOport = oportRows
      .slice(0, 40)
      .map(
        (r) =>
          `${r.titulo} [${r.categoria} • ${r.status}] savings ${brl(Number(r.savings ?? 0))} | custo extra ${brl(
            Number(r.custo_extra ?? 0),
          )}`,
      );

    const dossie = `
=== VOLUME E PRODUTIVIDADE POR MÊS (últimos 12 meses) ===
${linhasMes.join("\n") || "sem dados"}

=== VOLUME E PRODUTIVIDADE POR OPERAÇÃO ===
${linhasOp.join("\n") || "sem dados"}

=== CUSTO DE PESSOAL POR OPERAÇÃO ===
${linhasCusto.join("\n") || "sem dados"}
Custo total do período: ${brl(custoTotal)}
Volume total do período: ${num(volTotal, 0)}
Custo por processo: ${volTotal > 0 ? brl(custoTotal / volTotal) : "não calculável"}

=== NÃO CONFORMIDADES ===
Total: ${ncRows.length} ocorrências | Custo gerado ${brl(ncCusto)} | Recuperado ${brl(
      ncRecuperado,
    )} | Não recuperado ${brl(ncCusto - ncRecuperado)}
${linhasNC.join("\n") || "sem dados"}

=== SLA MIDEA (meta 90%) — média por unidade ===
${linhasMidea.join("\n") || "sem dados"}

=== SLA BOSCH (meta 90%) — média por planta ===
${linhasBosch.join("\n") || "sem dados"}

=== OPORTUNIDADES E RISCOS ===
Savings acumulado ${brl(savings)} | Custos extras ${brl(custoExtra)} | Saldo líquido ${brl(savings - custoExtra)}
${linhasOport.join("\n") || "sem registros"}
`.trim();

    const systemPrompt = `Você é um consultor sênior de operações logísticas e controladoria. Com base EXCLUSIVAMENTE nos dados consolidados fornecidos, produza uma análise SWOT executiva em português do Brasil.

REGRAS:
- Cite sempre NÚMEROS, MESES, OPERAÇÕES/UNIDADES presentes nos dados. Nunca invente informação.
- Meta de SLA: 90%. Indicadores abaixo disso são fraqueza/ameaça; acima, força.
- Relacione custo por processo, produtividade (volume por pessoa), perdas por não conformidade e savings.
- Forças e fraquezas são internas; oportunidades e ameaças olham para o resultado futuro e riscos financeiros/contratuais.
- Se algum bloco estiver "sem dados", não comente sobre ele.
- Responda SEMPRE chamando a função registrar_swot.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Dados consolidados:\n\n${dossie}\n\nGere a SWOT chamando registrar_swot.` },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "registrar_swot" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos ao workspace.");
      const txt = await res.text();
      throw new Error(`Falha na IA (${res.status}): ${txt.slice(0, 200)}`);
    }

    const payload = await res.json();
    const call = payload?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) throw new Error("IA não retornou estrutura esperada");

    const parsed = JSON.parse(call.function.arguments) as Partial<SwotIAResult>;
    return {
      insight: parsed.insight ?? "",
      forcas: parsed.forcas ?? [],
      fraquezas: parsed.fraquezas ?? [],
      oportunidades: parsed.oportunidades ?? [],
      ameacas: parsed.ameacas ?? [],
    };
  });
